import { describe, expect, it, vi } from "vitest";
import { FILTROS_PADRAO, lerFiltro, nomeBloqueado, ordenarLocal, ordemParaShopee, passaNosFiltros, ehOrdemLote } from "@/lib/lote";
import { buscarVariasPaginas, normalizarOferta } from "@/lib/shopee";

const ENV = { SHOPEE_APP_ID: "1234567", SHOPEE_SECRET: "segredo-de-teste" };
const no = (id: number, extra: Record<string, unknown> = {}) => ({
  itemId: String(id),
  shopId: "9",
  productName: `Produto ${id}`,
  imageUrl: "https://down-br.img.susercontent.com/file/abc",
  priceMin: "50",
  priceMax: "50",
  commissionRate: "0.1",
  sales: 100,
  ratingStar: "4.7",
  priceDiscountRate: 10,
  shopName: "Loja",
  productLink: `https://shopee.com.br/product/9/${id}`,
  offerLink: `https://s.shopee.com.br/x${id}`,
  ...extra,
});
const of = (extra: Record<string, unknown> = {}) => normalizarOferta(no(1, extra))!;

describe("filtros do lote", () => {
  it("lê número da URL com padrão, vírgula decimal e limites", () => {
    expect(lerFiltro(undefined, 50, 100)).toBe(50);
    expect(lerFiltro("", 50, 100)).toBe(50);
    expect(lerFiltro("abc", 50, 100)).toBe(50);
    expect(lerFiltro("4,5", 0, 5)).toBe(4.5);
    expect(lerFiltro("-3", 0, 5)).toBe(0);
    expect(lerFiltro("999", 0, 5)).toBe(5);
  });

  it("aplica vendas, nota, desconto e comissão; dado ausente não passa em filtro que o exige", () => {
    expect(passaNosFiltros(of(), FILTROS_PADRAO)).toBe(true);
    expect(passaNosFiltros(of({ sales: 10 }), FILTROS_PADRAO)).toBe(false);
    expect(passaNosFiltros(of({ ratingStar: "3.9" }), FILTROS_PADRAO)).toBe(false);
    expect(passaNosFiltros(of({ priceDiscountRate: 10 }), { ...FILTROS_PADRAO, descontoMin: 30 })).toBe(false);
    expect(passaNosFiltros(of({ priceDiscountRate: 40 }), { ...FILTROS_PADRAO, descontoMin: 30 })).toBe(true);
    expect(passaNosFiltros(of({ commissionRate: "0.03" }), { ...FILTROS_PADRAO, comissaoMin: 5 })).toBe(false);
    expect(passaNosFiltros(of({ sales: null }), FILTROS_PADRAO)).toBe(false);
    expect(passaNosFiltros(of({ sales: null, ratingStar: null }), { vendasMin: 0, descontoMin: 0, comissaoMin: 0, notaMin: 0 })).toBe(true);
  });

  it("ordem por desconto busca por vendas e reordena localmente", () => {
    expect(ehOrdemLote("desconto")).toBe(true);
    expect(ehOrdemLote("x")).toBe(false);
    expect(ordemParaShopee("desconto")).toBe("vendas");
    expect(ordemParaShopee("comissao")).toBe("comissao");
    const lista = [of({ priceDiscountRate: 5 }), of({ priceDiscountRate: 50 }), of({ priceDiscountRate: 20 })];
    expect(ordenarLocal(lista, "desconto").map((o) => o.desconto)).toEqual([50, 20, 5]);
    expect(ordenarLocal(lista, "vendas")).toBe(lista);
  });
});

describe("lista de bloqueio", () => {
  it("bloqueia termos sensíveis, sem acento e em qualquer caixa", () => {
    expect(nomeBloqueado("Munição 9mm")).toBe(true);
    expect(nomeBloqueado("ESSÊNCIA para narguilé")).toBe(true);
    expect(nomeBloqueado("Kit Vape Descartável")).toBe(true);
    expect(nomeBloqueado("Remédio para emagrecer")).toBe(true);
  });
  it("não bloqueia palavras que apenas contêm o termo", () => {
    expect(nomeBloqueado("Armário de cozinha")).toBe(false);
    expect(nomeBloqueado("Alarme residencial")).toBe(false);
    expect(nomeBloqueado("Air Fryer 4 Litros")).toBe(false);
  });
});

describe("buscarVariasPaginas", () => {
  const pagina = (de: number, qtd = 10) => ({ data: { productOfferV2: { nodes: Array.from({ length: qtd }, (_, i) => no(de * 100 + i)) } } });
  const resp = (c: unknown) => new Response(JSON.stringify(c));

  it("lê 5 páginas em sequência, sem repetir produtos, e indica a próxima", async () => {
    const buscar = vi.fn(async (_u: string, init: RequestInit) => {
      const p = Number(/page: (\d+)/.exec(String(init.body))![1]);
      return resp(pagina(p));
    });
    const r = await buscarVariasPaginas({ termo: "", de: 1 }, { env: ENV, buscar });
    expect(buscar).toHaveBeenCalledTimes(5);
    expect(r.ofertas).toHaveLength(50);
    expect(r.proximaPagina).toBe(6);
    expect(String(buscar.mock.calls[0][1].body)).not.toContain("keyword");
  });

  it("para quando a página vem incompleta e remove repetidos", async () => {
    const buscar = vi.fn(async (_u: string, init: RequestInit) => {
      const p = Number(/page: (\d+)/.exec(String(init.body))![1]);
      return resp(p === 1 ? pagina(1) : { data: { productOfferV2: { nodes: [no(100), no(999)] } } });
    });
    const r = await buscarVariasPaginas({ termo: "fone" }, { env: ENV, buscar });
    expect(r.ofertas.map((o) => o.itemId)).toEqual([...Array.from({ length: 10 }, (_, i) => String(100 + i)), "999"]);
    expect(r.proximaPagina).toBeNull();
  });

  it("falha depois da primeira página devolve o parcial com aviso; falha na primeira propaga o erro", async () => {
    let chamadas = 0;
    const parcial = vi.fn(async () => {
      chamadas++;
      return chamadas === 1 ? resp(pagina(1)) : resp({ errors: [{ message: "x", extensions: { code: 10030 } }] });
    });
    const r = await buscarVariasPaginas({ termo: "" }, { env: ENV, buscar: parcial });
    expect(r.ofertas).toHaveLength(10);
    expect(r.aviso).toMatch(/página 2/);
    const falha = vi.fn(async () => resp({ errors: [{ message: "x", extensions: { code: 10030 } }] }));
    await expect(buscarVariasPaginas({ termo: "" }, { env: ENV, buscar: falha })).rejects.toThrow();
  });
});
