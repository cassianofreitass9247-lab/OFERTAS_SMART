import { describe, expect, it, vi } from "vitest";
import { chaveDaAutomacao, chavesIguais, executarAutomacao, termoDaCategoria } from "@/lib/automacao";

const ENV = { SHOPEE_APP_ID: "1234567", SHOPEE_SECRET: "segredo-de-teste" };
const CATS = [
  { id: "c-beleza", nome: "Beleza", slug: "beleza" },
  { id: "c-eletro", nome: "Eletrodomésticos", slug: "eletrodomesticos" },
  { id: "c-brinq", nome: "Brinquedos", slug: "brinquedos" },
];
const estado = (extra: Record<string, unknown> = {}) => ({ ativo: true, limite_diario: 30, criados_hoje: 0, vendas_min: 100, nota_min: 4.5, desconto_min: 20, comissao_min: 0, cursor: 0, categorias: CATS, ...extra });

const consulta = (init: RequestInit) => (JSON.parse(String(init.body)) as { query: string }).query;
const termoDe = (init: RequestInit) => /keyword: "([^"]*)"/.exec(consulta(init))?.[1] ?? "";

const no = (id: number, nome: string, extra: Record<string, unknown> = {}) => ({
  itemId: String(id),
  shopId: "9",
  productName: nome,
  imageUrl: "https://down-br.img.susercontent.com/file/x",
  priceMin: "50",
  priceMax: "50",
  commissionRate: "0.1",
  sales: 500,
  ratingStar: "4.8",
  priceDiscountRate: 30,
  shopName: "Loja",
  productLink: `https://shopee.com.br/product/9/${id}`,
  offerLink: `https://s.shopee.com.br/x${id}`,
  ...extra,
});

function fakeSb(est: unknown, extra: { falhaEstado?: boolean } = {}) {
  const chamadas: { nome: string; args: Record<string, unknown> }[] = [];
  const rpc = vi.fn(async (nome: string, args: Record<string, unknown>) => {
    chamadas.push({ nome, args });
    if (nome === "automacao_estado") return extra.falhaEstado ? { data: null, error: { message: "Acesso negado" } } : { data: est, error: null };
    if (nome === "automacao_registrar") return { data: { criados: (args.p_itens as unknown[]).length, ignorados: 0 }, error: null };
    return { data: null, error: null };
  });
  return { sb: { rpc } as never, chamadas };
}
const loja = (porTermo: Record<string, unknown[]>) =>
  vi.fn(async (_u: string, init: RequestInit) => {
    const termo = termoDe(init);
    const pagina = Number(/page: (\d+)/.exec(consulta(init))?.[1] ?? 1);
    return new Response(JSON.stringify({ data: { productOfferV2: { nodes: pagina === 1 ? (porTermo[termo] ?? []) : [] } } }));
  });

describe("chave e utilidades", () => {
  it("chave derivada do segredo; sem segredo não há chave", async () => {
    expect(await chaveDaAutomacao({})).toBeNull();
    const a = await chaveDaAutomacao(ENV);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(await chaveDaAutomacao(ENV));
    expect(a).not.toBe(await chaveDaAutomacao({ SHOPEE_SECRET: "outro" }));
  });
  it("compara chaves e tira o ano do termo da categoria", () => {
    expect(chavesIguais("abc", "abc")).toBe(true);
    expect(chavesIguais("abc", "abd")).toBe(false);
    expect(chavesIguais("abc", "abcd")).toBe(false);
    expect(termoDaCategoria("Natal 2026")).toBe("Natal");
    expect(termoDaCategoria("Mãe e Bebê")).toBe("Mãe e Bebê");
  });
});

describe("executarAutomacao", () => {
  it("pausada: não busca nada", async () => {
    const { sb, chamadas } = fakeSb(estado({ ativo: false }));
    const buscar = loja({});
    expect(await executarAutomacao(sb, "k", { env: ENV, buscar })).toEqual({ status: "pausada" });
    expect(buscar).not.toHaveBeenCalled();
    expect(chamadas.map((c) => c.nome)).toEqual(["automacao_estado"]);
  });

  it("limite do dia atingido: registra a execução vazia e não busca", async () => {
    const { sb, chamadas } = fakeSb(estado({ criados_hoje: 30 }));
    const buscar = loja({});
    expect(await executarAutomacao(sb, "k", { env: ENV, buscar })).toEqual({ status: "limite", criadosHoje: 30 });
    expect(buscar).not.toHaveBeenCalled();
    expect(chamadas[1]).toMatchObject({ nome: "automacao_registrar", args: { p_itens: [] } });
  });

  it("estado ilegível (chave errada, migração ausente) vira erro", async () => {
    const { sb } = fakeSb(null, { falhaEstado: true });
    expect(await executarAutomacao(sb, "k", { env: ENV, buscar: loja({}) })).toMatchObject({ status: "erro", erro: "Acesso negado" });
  });

  it("escolhe só o que passa nos filtros, tem foto, não é bloqueado e combina com a categoria; ordena por desconto", async () => {
    const { sb, chamadas } = fakeSb(estado());
    const buscar = loja({
      Beleza: [
        no(1, "Batom Líquido Matte", { priceDiscountRate: 25 }),
        no(2, "Perfume Importado 100ml", { priceDiscountRate: 60 }),
        no(3, "Batom Vendas Baixas", { sales: 5 }),
        no(4, "Batom Nota Baixa", { ratingStar: "3.9" }),
        no(5, "Batom Sem Desconto", { priceDiscountRate: 5 }),
        no(6, "Batom Sem Foto", { imageUrl: "http://sem-https.com/a.jpg" }),
        no(7, "Fritadeira Air Fryer 4L", { priceDiscountRate: 70 }), // outra categoria: não entra em Beleza
        no(8, "Munição de brinquedo vape", { priceDiscountRate: 50 }), // termo bloqueado
      ],
      Eletrodomésticos: [no(10, "Liquidificador 900W", { priceDiscountRate: 40 })],
      Brinquedos: [],
    });
    const r = await executarAutomacao(sb, "k", { env: ENV, buscar });
    expect(r).toMatchObject({ status: "ok", criados: 3 });
    const reg = chamadas.find((c) => c.nome === "automacao_registrar")!;
    const itens = reg.args.p_itens as { nome: string; categoria_id: string; id_externo: string; slug: string }[];
    // intercalado: 1ª rodada = melhor de cada categoria
    expect(itens.map((i) => i.nome)).toEqual(["Perfume Importado 100ml", "Liquidificador 900W", "Batom Líquido Matte"]);
    expect(itens.map((i) => i.categoria_id)).toEqual(["c-beleza", "c-eletro", "c-beleza"]);
    expect(itens[0].id_externo).toBe("9.2");
    expect(itens[0].slug).toMatch(/^perfume-importado-100ml-[a-z0-9]{6}$/);
    expect(reg.args.p_cursor).toBe(0); // 3 de 3 categorias -> volta ao início
    expect(reg.args.p_filtros).toMatchObject({ automatico: true, vendasMin: 100, notaMin: 4.5, descontoMin: 20 });
  });

  it("respeita o que falta da cota do dia", async () => {
    const { sb, chamadas } = fakeSb(estado({ limite_diario: 30, criados_hoje: 28 }));
    const buscar = loja({ Beleza: [no(1, "Batom A"), no(2, "Batom B"), no(3, "Batom C")], Eletrodomésticos: [no(4, "Fritadeira Air Fryer")], Brinquedos: [no(5, "Boneca Infantil Brinquedo")] });
    await executarAutomacao(sb, "k", { env: ENV, buscar });
    const reg = chamadas.find((c) => c.nome === "automacao_registrar")!;
    expect((reg.args.p_itens as unknown[]).length).toBe(2);
  });

  it("rodízio de categorias: 6 por execução, a partir do cursor", async () => {
    const muitas = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, nome: `Cat${i}`, slug: `cat${i}` }));
    const { sb, chamadas } = fakeSb(estado({ categorias: muitas, cursor: 5 }));
    const buscar = loja({});
    await executarAutomacao(sb, "k", { env: ENV, buscar });
    const termos = buscar.mock.calls.map((c) => termoDe(c[1] as RequestInit));
    expect(termos).toEqual(["Cat5", "Cat6", "Cat7", "Cat0", "Cat1", "Cat2"]);
    expect(chamadas.find((c) => c.nome === "automacao_registrar")!.args.p_cursor).toBe(3);
  });

  it("Shopee fora do ar em todas as categorias: avisa o banco (contador de falhas) e devolve erro", async () => {
    const { sb, chamadas } = fakeSb(estado());
    const buscar = vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: "x", extensions: { code: 10030 } }] })));
    const r = await executarAutomacao(sb, "k", { env: ENV, buscar });
    expect(r.status).toBe("erro");
    expect(chamadas.map((c) => c.nome)).toContain("automacao_falha");
    expect(chamadas.map((c) => c.nome)).not.toContain("automacao_registrar");
  });

  it("falha em só uma categoria não derruba as outras", async () => {
    const { sb } = fakeSb(estado());
    const buscar = vi.fn(async (_u: string, init: RequestInit) => {
      const termo = termoDe(init);
      if (termo === "Beleza") return new Response(JSON.stringify({ errors: [{ message: "x", extensions: { code: 10030 } }] }));
      return new Response(JSON.stringify({ data: { productOfferV2: { nodes: termo === "Eletrodomésticos" ? [no(10, "Liquidificador 900W")] : [] } } }));
    });
    const r = await executarAutomacao(sb, "k", { env: ENV, buscar });
    expect(r).toMatchObject({ status: "ok", criados: 1, falhas: 1 });
  });
});
