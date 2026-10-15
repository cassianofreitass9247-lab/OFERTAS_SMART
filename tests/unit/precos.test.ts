import { describe, expect, it, vi } from "vitest";
import { sincronizarPrecos } from "@/lib/precos";

const ENV = { SHOPEE_APP_ID: "1234567", SHOPEE_SECRET: "segredo-de-teste" };
const consulta = (init: RequestInit) => (JSON.parse(String(init.body)) as { query: string }).query;
const no = (itemId: string, shopId: string, preco: string) => ({
  itemId, shopId, productName: `Produto ${itemId}`, imageUrl: "https://down-br.img.susercontent.com/file/x", priceMin: preco, priceMax: preco,
  commissionRate: "0.1", sales: 500, ratingStar: "4.8", priceDiscountRate: 0, shopName: "Loja", productLink: `https://shopee.com.br/product/${shopId}/${itemId}`, offerLink: `https://s.shopee.com.br/x${itemId}`,
});

function fakeSb(pendentes: { id_externo: string; preco_atual: number }[], extra: { erroPendentes?: boolean } = {}) {
  const chamadas: { nome: string; args: Record<string, unknown> }[] = [];
  const rpc = vi.fn(async (nome: string, args: Record<string, unknown>) => {
    chamadas.push({ nome, args });
    if (nome === "precos_pendentes") return extra.erroPendentes ? { data: null, error: { message: "Acesso negado" } } : { data: pendentes, error: null };
    if (nome === "precos_aplicar") return { data: { conferidos: (args.p_itens as unknown[]).length, quedas: 1, altas: 0, suspeitos: 0, ausentes: 0 }, error: null };
    return { data: null, error: null };
  });
  return { sb: { rpc } as never, chamadas };
}

describe("sincronizarPrecos", () => {
  it("consulta cada produto pelo id da Shopee e manda os preços ao banco", async () => {
    const { sb, chamadas } = fakeSb([{ id_externo: "9.100", preco_atual: 50 }, { id_externo: "9.101", preco_atual: 80 }]);
    const buscar = vi.fn(async (_u: string, init: RequestInit) => {
      const q = consulta(init);
      const item = /itemId: (\d+)/.exec(q)![1];
      expect(q).toContain("shopId: 9");
      return new Response(JSON.stringify({ data: { productOfferV2: { nodes: [no(item, "9", item === "100" ? "39.90" : "80")] } } }));
    });
    const r = await sincronizarPrecos(sb, "k", { env: ENV, buscar });
    expect(r).toMatchObject({ status: "ok", conferidos: 2 });
    expect(chamadas.find((c) => c.nome === "precos_aplicar")!.args.p_itens).toEqual([
      { id_externo: "9.100", preco: 39.9 },
      { id_externo: "9.101", preco: 80 },
    ]);
  });

  it("produto que a Shopee não devolve vai com preço nulo (sai da fila, sem mudar o preço)", async () => {
    const { sb, chamadas } = fakeSb([{ id_externo: "9.100", preco_atual: 50 }]);
    const buscar = vi.fn(async () => new Response(JSON.stringify({ data: { productOfferV2: { nodes: [] } } })));
    await sincronizarPrecos(sb, "k", { env: ENV, buscar });
    expect(chamadas.find((c) => c.nome === "precos_aplicar")!.args.p_itens).toEqual([{ id_externo: "9.100", preco: null }]);
  });

  it("sem produtos ou conferência desligada: não consulta a Shopee", async () => {
    const { sb } = fakeSb([]);
    const buscar = vi.fn();
    expect(await sincronizarPrecos(sb, "k", { env: ENV, buscar })).toEqual({ status: "nada_a_conferir" });
    expect(buscar).not.toHaveBeenCalled();
  });

  it("limite de consultas no meio: grava o que já conferiu e informa onde parou", async () => {
    const { sb, chamadas } = fakeSb([{ id_externo: "9.100", preco_atual: 50 }, { id_externo: "9.101", preco_atual: 80 }, { id_externo: "9.102", preco_atual: 80 }]);
    let n = 0;
    const buscar = vi.fn(async (_u: string, init: RequestInit) => {
      n++;
      if (n === 2) return new Response(JSON.stringify({ errors: [{ message: "x", extensions: { code: 10030 } }] }));
      return new Response(JSON.stringify({ data: { productOfferV2: { nodes: [no(/itemId: (\d+)/.exec(consulta(init))![1], "9", "40")] } } }));
    });
    const r = await sincronizarPrecos(sb, "k", { env: ENV, buscar });
    expect(r).toMatchObject({ status: "ok", conferidos: 1 });
    expect((r as { parouPor?: string }).parouPor).toMatch(/Limite de consultas/);
    expect(chamadas.find((c) => c.nome === "precos_aplicar")!.args.p_itens).toHaveLength(1);
    expect(buscar).toHaveBeenCalledTimes(2); // não insiste depois do erro
  });

  it("falha logo na primeira consulta: registra a falha e não grava preços", async () => {
    const { sb, chamadas } = fakeSb([{ id_externo: "9.100", preco_atual: 50 }]);
    const buscar = vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: "x", extensions: { code: 10020 } }] })));
    const r = await sincronizarPrecos(sb, "k", { env: ENV, buscar });
    expect(r.status).toBe("erro");
    expect(chamadas.map((c) => c.nome)).toEqual(["precos_pendentes", "precos_falha"]);
  });

  it("chave recusada pelo banco vira erro", async () => {
    const { sb } = fakeSb([], { erroPendentes: true });
    expect(await sincronizarPrecos(sb, "k", { env: ENV, buscar: vi.fn() })).toMatchObject({ status: "erro", erro: "Acesso negado" });
  });

  it("orçamento: no máximo 35 produtos por execução + 2 chamadas ao banco (<= 50 externas)", async () => {
    const { sb, chamadas } = fakeSb(Array.from({ length: 35 }, (_, i) => ({ id_externo: `9.${100 + i}`, preco_atual: 50 })));
    const buscar = vi.fn(async (_u: string, init: RequestInit) => new Response(JSON.stringify({ data: { productOfferV2: { nodes: [no(/itemId: (\d+)/.exec(consulta(init))![1], "9", "50")] } } })));
    await sincronizarPrecos(sb, "k", { env: ENV, buscar });
    expect(buscar.mock.calls.length + chamadas.length).toBeLessThanOrEqual(50);
    expect(chamadas[0].args.p_limite).toBe(35);
  });
});
