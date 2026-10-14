import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  assinar,
  buscarOfertaPorItem,
  buscarOfertas,
  configShopee,
  consultarShopee,
  ErroShopee,
  extrairIds,
  interpretarEntrada,
  normalizarOferta,
  precoDaOferta,
  resolverLinkCurto,
} from "@/lib/shopee";

const ENV = { SHOPEE_APP_ID: "1234567", SHOPEE_SECRET: "segredo-de-teste" };
const AGORA = () => 1_700_000_000_000;
const resposta = (corpo: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(corpo), { status }));
const no = (extra: Record<string, unknown> = {}) => ({
  itemId: "456",
  shopId: "123",
  productName: "Air Fryer 4L",
  imageUrl: "https://down-br.img.susercontent.com/file/abc",
  priceMin: "199.90",
  priceMax: "249.90",
  commissionRate: "0.085",
  sales: 1500,
  ratingStar: "4.8",
  priceDiscountRate: 20,
  shopName: "Loja Exemplo",
  productLink: "https://shopee.com.br/product/123/456",
  offerLink: "https://s.shopee.com.br/AAbbCC",
  ...extra,
});

describe("configuração e assinatura", () => {
  it("só fica ativo com AppID e Secret; um sem o outro é configuração incompleta", () => {
    expect(configShopee({}).ativo).toBe(false);
    expect(configShopee(ENV)).toMatchObject({ ativo: true, incompleto: false });
    expect(configShopee({ SHOPEE_APP_ID: "1" })).toMatchObject({ ativo: false, incompleto: true });
    expect(configShopee({ SHOPEE_APP_ID: " 1 ", SHOPEE_SECRET: " s " })).toMatchObject({ appId: "1", secret: "s" });
  });

  it("assinatura = SHA256(AppID + Timestamp + corpo + Secret), em hexadecimal minúsculo", async () => {
    const esperado = createHash("sha256").update('1234567' + '1700000000' + '{"query":"{a}"}' + "segredo-de-teste").digest("hex");
    expect(await assinar("1234567", "segredo-de-teste", 1_700_000_000, '{"query":"{a}"}')).toBe(esperado);
  });
});

describe("consultarShopee", () => {
  it("envia POST com cabeçalho SHA256 Credential/Timestamp/Signature sobre o corpo exato", async () => {
    const buscar = resposta({ data: { ok: true } });
    await consultarShopee("{ x }", { env: ENV, buscar, agora: AGORA });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://open-api.affiliate.shopee.com.br/graphql");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"query":"{ x }"}');
    const assinatura = createHash("sha256").update("1234567" + "1700000000" + init.body + "segredo-de-teste").digest("hex");
    expect((init.headers as Record<string, string>).Authorization).toBe(`SHA256 Credential=1234567, Timestamp=1700000000, Signature=${assinatura}`);
    expect(JSON.stringify(init)).not.toContain("segredo-de-teste");
  });

  it("sem credenciais, não chama a Shopee", async () => {
    const buscar = resposta({ data: {} });
    await expect(consultarShopee("{ x }", { env: {}, buscar })).rejects.toThrow(/não está configurada/);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("traduz os códigos de erro da Shopee e nunca vaza o Secret", async () => {
    for (const [codigo, trecho] of [[10020, /recusou as credenciais/], [10030, /Limite de consultas/], [10035, /Open API/], [10033, /congelada/]] as const) {
      const buscar = resposta({ errors: [{ message: "x", extensions: { code: codigo, message: "x" } }] });
      const erro = await consultarShopee("{ x }", { env: ENV, buscar }).catch((e) => e);
      expect(erro).toBeInstanceOf(ErroShopee);
      expect(erro.codigo).toBe(codigo);
      expect(erro.message).toMatch(trecho);
      expect(erro.message).not.toContain("segredo-de-teste");
    }
    const e11001 = await consultarShopee("{ x }", { env: ENV, buscar: resposta({ errors: [{ extensions: { code: 11001, message: "itemId inválido" } }] }) }).catch((e) => e);
    expect(e11001.message).toMatch(/parâmetros.*itemId inválido/);
  });

  it("erro HTTP sem JSON e falha de rede viram mensagens claras", async () => {
    const html = vi.fn(async () => new Response("<html>", { status: 502 }));
    await expect(consultarShopee("{ x }", { env: ENV, buscar: html })).rejects.toThrow(/HTTP 502/);
    const rede = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(consultarShopee("{ x }", { env: ENV, buscar: rede })).rejects.toThrow(/sem resposta/);
  });

  it("só aceita endereço alternativo da API em 127.0.0.1/localhost (testes)", async () => {
    const buscar = resposta({ data: {} });
    await consultarShopee("{ x }", { env: { ...ENV, SHOPEE_API_URL: "https://malicioso.com/graphql" }, buscar });
    await consultarShopee("{ x }", { env: { ...ENV, SHOPEE_API_URL: "http://127.0.0.1:54321/shopee/graphql" }, buscar });
    expect(buscar.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      "https://open-api.affiliate.shopee.com.br/graphql",
      "http://127.0.0.1:54321/shopee/graphql",
    ]);
  });
});

describe("ofertas", () => {
  it("normaliza campos (números em texto, comissão em fração, links https)", () => {
    const o = normalizarOferta(no())!;
    expect(o).toMatchObject({ itemId: "456", shopId: "123", nome: "Air Fryer 4L", precoMin: 199.9, precoMax: 249.9, comissao: 8.5, vendas: 1500, nota: 4.8, desconto: 20 });
    expect(precoDaOferta(o)).toBe(199.9);
    expect(normalizarOferta(no({ commissionRate: "8.5" }))!.comissao).toBe(8.5);
    expect(normalizarOferta(no({ imageUrl: "http://inseguro.com/a.jpg" }))!.imagemUrl).toBeNull();
    expect(normalizarOferta(no({ offerLink: "javascript:alert(1)" }))!.linkAfiliado).toBeNull();
  });

  it("descarta ofertas sem identificação ou sem nome", () => {
    expect(normalizarOferta(no({ itemId: "abc" }))).toBeNull();
    expect(normalizarOferta(no({ productName: "" }))).toBeNull();
    expect(normalizarOferta(null)).toBeNull();
    expect(precoDaOferta(normalizarOferta(no({ priceMin: "0" }))!)).toBeNull();
  });

  it("busca por produto monta a consulta só com IDs numéricos e rejeita o resto", async () => {
    const buscar = resposta({ data: { productOfferV2: { nodes: [no()] } } });
    const o = await buscarOfertaPorItem("456", "123", { env: ENV, buscar });
    expect(o?.nome).toBe("Air Fryer 4L");
    const corpo = JSON.parse((buscar.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(corpo.query).toContain("productOfferV2(itemId: 456, shopId: 123, limit: 1)");
    await expect(buscarOfertaPorItem("1) { x } #", "123", { env: ENV, buscar })).rejects.toThrow(/inválido/);
  });

  it("busca por palavra escapa o texto, limita tamanho e informa se há mais páginas", async () => {
    const nos = Array.from({ length: 10 }, (_, i) => no({ itemId: String(1000 + i) }));
    const buscar = resposta({ data: { productOfferV2: { nodes: nos } } });
    const r = await buscarOfertas({ termo: 'panela "inox"\n} mutation { x', ordem: "comissao", pagina: 2 }, { env: ENV, buscar });
    expect(r.ofertas).toHaveLength(10);
    expect(r.temMais).toBe(true);
    const query = JSON.parse((buscar.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).query as string;
    expect(query).toContain('keyword: "panela \\"inox\\" } mutation { x"');
    expect(query).toContain("sortType: 5, page: 2, limit: 10");
    await expect(buscarOfertas({ termo: "a" }, { env: ENV, buscar })).rejects.toThrow(/2 letras/);
    const poucos = await buscarOfertas({ termo: "panela" }, { env: ENV, buscar: resposta({ data: { productOfferV2: { nodes: [no()] } } }) });
    expect(poucos.temMais).toBe(false);
  });

  it("resposta fora do formato esperado vira erro claro", async () => {
    await expect(buscarOfertas({ termo: "panela" }, { env: ENV, buscar: resposta({ data: { outraCoisa: 1 } }) })).rejects.toThrow(/formato inesperado/);
  });
});

describe("link, número ou palavra", () => {
  it("lê os IDs dos formatos de link conhecidos", () => {
    expect(extrairIds("https://shopee.com.br/Air-Fryer-4L-i.123.456?sp_atk=x")).toEqual({ shopId: "123", itemId: "456" });
    expect(extrairIds("https://shopee.com.br/product/123/456")).toEqual({ shopId: "123", itemId: "456" });
    expect(extrairIds("https://shopee.com.br/universal-link?redir=" + encodeURIComponent("https://shopee.com.br/opaanlp/123/456"))).toEqual({ shopId: "123", itemId: "456" });
    expect(extrairIds("https://shopee.com.br/")).toBeNull();
  });

  it("interpreta a entrada", () => {
    expect(interpretarEntrada("456")).toEqual({ tipo: "item", itemId: "456", shopId: null });
    expect(interpretarEntrada("Olha esse: https://shopee.com.br/product/123/456 obrigada")).toEqual({ tipo: "item", itemId: "456", shopId: "123" });
    expect(interpretarEntrada("https://s.shopee.com.br/AAbbCC")).toEqual({ tipo: "curto", url: "https://s.shopee.com.br/AAbbCC" });
    expect(interpretarEntrada("air fryer 4 litros")).toEqual({ tipo: "palavra", termo: "air fryer 4 litros" });
    expect(interpretarEntrada("https://exemplo.com/produto").tipo).toBe("erro");
    expect(interpretarEntrada("https://shopee.com.br.malicioso.com/x").tipo).toBe("erro");
    expect(interpretarEntrada("http://shopee.com.br/product/1/2").tipo).toBe("erro");
    expect(interpretarEntrada("   ").tipo).toBe("erro");
  });
});

describe("link curto (SSRF)", () => {
  const redireciona = (...destinos: string[]) => {
    let i = 0;
    return vi.fn(async () => new Response(null, { status: 302, headers: { location: destinos[i++] } }));
  };

  it("segue o redirecionamento e acha os IDs", async () => {
    const buscar = redireciona("https://shopee.com.br/universal-link?x=1", "https://shopee.com.br/product/123/456?a=b");
    expect(await resolverLinkCurto("https://s.shopee.com.br/AAbbCC", buscar)).toEqual({ shopId: "123", itemId: "456" });
    expect(buscar).toHaveBeenCalledTimes(2);
    expect((buscar.mock.calls[0] as unknown as [string, RequestInit])[1].redirect).toBe("manual");
  });

  it("não segue redirecionamento para fora da Shopee", async () => {
    const buscar = redireciona("https://malicioso.com/x");
    const r = await resolverLinkCurto("https://s.shopee.com.br/AAbbCC", buscar);
    expect("erro" in r).toBe(true);
    expect(buscar).toHaveBeenCalledTimes(1);
    const interno = redireciona("http://127.0.0.1/admin");
    expect("erro" in (await resolverLinkCurto("https://shope.ee/x", interno))).toBe(true);
  });

  it("recusa de saída endereços que não são da Shopee e limita os saltos", async () => {
    const nunca = vi.fn();
    expect("erro" in (await resolverLinkCurto("https://exemplo.com/x", nunca))).toBe(true);
    expect(nunca).not.toHaveBeenCalled();
    const infinito = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://shopee.com.br/outra" } }));
    expect("erro" in (await resolverLinkCurto("https://shope.ee/x", infinito))).toBe(true);
    expect(infinito).toHaveBeenCalledTimes(4);
  });

  it("resposta sem redirecionamento ou com falha de rede vira erro claro", async () => {
    const ok200 = vi.fn(async () => new Response("<html>", { status: 200 }));
    expect("erro" in (await resolverLinkCurto("https://shope.ee/x", ok200))).toBe(true);
    const rede = vi.fn(async () => {
      throw new Error("x");
    });
    expect("erro" in (await resolverLinkCurto("https://shope.ee/x", rede))).toBe(true);
  });
});
