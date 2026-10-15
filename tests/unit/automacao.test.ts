import { describe, expect, it, vi } from "vitest";
import { chaveDaAutomacao, chavesIguais, diaDeBrasilia, executarAutomacao, proximaExecucao, termoDaCategoria, termosDoDia } from "@/lib/automacao";
import { termosDeBusca } from "@/lib/categoria-auto";

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

function fakeSb(est: unknown, extra: { falhaEstado?: boolean; existentes?: string[]; vez?: boolean } = {}) {
  const chamadas: { nome: string; args: Record<string, unknown> }[] = [];
  const rpc = vi.fn(async (nome: string, args: Record<string, unknown>) => {
    chamadas.push({ nome, args });
    if (nome === "automacao_estado") return extra.falhaEstado ? { data: null, error: { message: "Acesso negado" } } : { data: est, error: null };
    if (nome === "automacao_reivindicar") return { data: extra.vez ?? true, error: null };
    if (nome === "automacao_existentes") return { data: (args.p_ids as string[]).filter((i) => (extra.existentes ?? []).includes(i)), error: null };
    if (nome === "automacao_registrar") return { data: { criados: (args.p_itens as unknown[]).length, ignorados: 0 }, error: null };
    return { data: null, error: null };
  });
  return { sb: { rpc } as never, chamadas };
}
/** Simula a Shopee: o termo buscado leva à categoria dona dele (pelos termos de busca) e devolve os produtos dela, só na página 1. */
const loja = (porCategoria: Record<string, unknown[]>, catsDeTeste = CATS) =>
  vi.fn(async (_u: string, init: RequestInit) => {
    const termo = termoDe(init);
    const pagina = Number(/page: (\d+)/.exec(consulta(init))?.[1] ?? 1);
    const dona = catsDeTeste.find((c) => termosDeBusca(c).includes(termo));
    return new Response(JSON.stringify({ data: { productOfferV2: { nodes: pagina === 1 && dona ? (porCategoria[dona.nome] ?? []) : [] } } }));
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
    const buscar = loja({}, muitas);
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
      if (termosDeBusca(CATS[0]).includes(termo)) return new Response(JSON.stringify({ errors: [{ message: "x", extensions: { code: 10030 } }] }));
      return new Response(JSON.stringify({ data: { productOfferV2: { nodes: termosDeBusca(CATS[1]).includes(termo) ? [no(10, "Liquidificador 900W")] : [] } } }));
    });
    const r = await executarAutomacao(sb, "k", { env: ENV, buscar });
    expect(r).toMatchObject({ status: "ok", criados: 1, falhas: 1 });
  });

  it("não gasta a cota com produtos que já existem no site", async () => {
    const { sb, chamadas } = fakeSb(estado(), { existentes: ["9.1", "9.2"] });
    const buscar = loja({ Beleza: [no(1, "Batom A", { priceDiscountRate: 90 }), no(2, "Batom B", { priceDiscountRate: 80 }), no(3, "Batom C", { priceDiscountRate: 30 })] });
    await executarAutomacao(sb, "k", { env: ENV, buscar });
    const itens = chamadas.find((c) => c.nome === "automacao_registrar")!.args.p_itens as { nome: string }[];
    expect(itens.map((i) => i.nome)).toEqual(["Batom C"]);
  });

  it("preço mínimo, exclusões da categoria (brinquedo de pet) e preço ausente", async () => {
    const { sb, chamadas } = fakeSb(estado());
    const buscar = loja({
      Brinquedos: [
        no(1, "Boneca Infantil Brinquedo"),
        no(2, "Brinquedo para Gato Bolinha", { priceDiscountRate: 80 }),
        no(3, "Brinquedo Cachorro Mordedor", { priceDiscountRate: 80 }),
        no(4, "Brinquedo Boneca Barata", { priceMin: "9.9", priceMax: "9.9" }),
        no(5, "Brinquedo Boneca Sem Preço", { priceMin: null, priceMax: null }),
      ],
    });
    await executarAutomacao(sb, "k", { env: ENV, buscar });
    const itens = chamadas.find((c) => c.nome === "automacao_registrar")!.args.p_itens as { nome: string }[];
    expect(itens.map((i) => i.nome)).toEqual(["Boneca Infantil Brinquedo"]);
  });

  it("a cota se divide entre as categorias e o que uma não preenche vai para as outras", async () => {
    const { sb, chamadas } = fakeSb(estado({ limite_diario: 6 }));
    const buscar = loja({
      Beleza: [1, 2, 3, 4, 5, 6].map((i) => no(i, `Batom ${i}`, { priceDiscountRate: 50 - i })),
      Eletrodomésticos: [no(20, "Liquidificador 900W")],
      Brinquedos: [no(30, "Boneca Infantil Brinquedo")],
    });
    await executarAutomacao(sb, "k", { env: ENV, buscar });
    const itens = chamadas.find((c) => c.nome === "automacao_registrar")!.args.p_itens as { categoria_id: string }[];
    expect(itens).toHaveLength(6);
    expect(itens.slice(0, 3).map((i) => i.categoria_id).sort()).toEqual(["c-beleza", "c-brinq", "c-eletro"]);
    expect(itens.filter((i) => i.categoria_id === "c-beleza")).toHaveLength(4);
  });

  it("termos do dia: avançam a cada dia, sem estourar a lista, e o dia usa o fuso de Brasília", () => {
    const cat = CATS[0];
    const todos = termosDeBusca(cat);
    expect(termosDoDia(cat, 0)).toEqual([todos[0], todos[1]]);
    expect(termosDoDia(cat, 1)).toEqual([todos[2], todos[3]]);
    expect(termosDoDia(cat, todos.length)).toHaveLength(2);
    expect(termosDoDia(cat, -1)).toHaveLength(2);
    expect(termosDoDia({ id: "x", nome: "Natal 2099", slug: "outra" }, 5)).toEqual(["Natal"]);
    // 01:00 UTC ainda é o dia anterior em Brasília
    expect(diaDeBrasilia(Date.UTC(2026, 9, 15, 1, 0))).toBe(diaDeBrasilia(Date.UTC(2026, 9, 14, 12, 0)));
    expect(diaDeBrasilia(Date.UTC(2026, 9, 15, 12, 0))).toBe(diaDeBrasilia(Date.UTC(2026, 9, 14, 12, 0)) + 1);
  });

  it("respeita o orçamento de chamadas externas do plano gratuito (<= 50 por execução)", async () => {
    const todas = [
      ["Beleza", "beleza"], ["Brinquedos", "brinquedos"], ["Casa e construção", "casa-e-construcao"], ["Eletrodomésticos", "eletrodomesticos"], ["Eletrônicos", "eletronicos"], ["Esporte e Lazer", "esporte-e-lazer"], ["Mãe e Bebê", "mae-e-bebe"],
    ].map(([nome, slug]) => ({ id: slug, nome, slug }));
    const { sb, chamadas } = fakeSb(estado({ categorias: todas }));
    const cheia = vi.fn(async () => new Response(JSON.stringify({ data: { productOfferV2: { nodes: Array.from({ length: 10 }, (_, i) => no(i + 1, `Produto ${i}`)) } } })));
    await executarAutomacao(sb, "k", { env: ENV, buscar: cheia });
    expect(cheia.mock.calls.length + chamadas.length).toBeLessThanOrEqual(50);
  });

  it("execução agendada fora da vez (dia, hora ou já rodou hoje): não busca nada", async () => {
    const { sb, chamadas } = fakeSb(estado(), { vez: false });
    const buscar = loja({});
    expect(await executarAutomacao(sb, "k", { env: ENV, buscar, agendada: true })).toEqual({ status: "fora_do_horario" });
    expect(buscar).not.toHaveBeenCalled();
    expect(chamadas.map((c) => c.nome)).toEqual(["automacao_reivindicar"]);
  });

  it("execução agendada na vez roda normalmente; a manual nem pergunta ao banco se é a vez", async () => {
    const a = fakeSb(estado(), { vez: true });
    expect(await executarAutomacao(a.sb, "k", { env: ENV, buscar: loja({ Beleza: [no(1, "Batom Matte")] }), agendada: true })).toMatchObject({ status: "ok", criados: 1 });
    expect(a.chamadas[0].nome).toBe("automacao_reivindicar");
    const m = fakeSb(estado(), { vez: false });
    await executarAutomacao(m.sb, "k", { env: ENV, buscar: loja({}) });
    expect(m.chamadas.map((c) => c.nome)).not.toContain("automacao_reivindicar");
  });
});

describe("proximaExecucao (horário de Brasília)", () => {
  const TODOS = [0, 1, 2, 3, 4, 5, 6];
  const br = (a: number, m: number, d: number, h: number, min = 0) => Date.UTC(a, m - 1, d, h + 3, min); // 2026-10-15 é quinta
  it("hoje, se a hora ainda não chegou e hoje não rodou", () => {
    expect(proximaExecucao(TODOS, 9, br(2026, 10, 15, 7), "2026-10-14")?.texto).toBe("hoje às 09h");
  });
  it("hoje já rodou: amanhã", () => {
    expect(proximaExecucao(TODOS, 9, br(2026, 10, 15, 10), "2026-10-15")?.texto).toBe("amanhã (16/10) às 09h");
  });
  it("hora já passou e hoje ainda não rodou: na próxima hora cheia", () => {
    expect(proximaExecucao(TODOS, 9, br(2026, 10, 15, 11), "2026-10-14")?.texto).toBe("hoje, na próxima hora cheia");
  });
  it("só alguns dias: pula para o próximo dia escolhido, com o nome do dia", () => {
    // quinta já rodou; escolhidos: segunda e quarta -> segunda 19/10
    expect(proximaExecucao([1, 3], 8, br(2026, 10, 15, 10), "2026-10-15")?.texto).toBe("segunda (19/10) às 08h");
    // virada de mês e fuso: 01:00 UTC de 01/11 ainda é 31/10 em Brasília (sábado)
    expect(proximaExecucao([0], 9, Date.UTC(2026, 10, 1, 1, 0), null)?.texto).toBe("amanhã (01/11) às 09h");
  });
  it("nenhum dia válido: nada", () => {
    expect(proximaExecucao([], 9, br(2026, 10, 15, 7), null)).toBeNull();
    expect(proximaExecucao([9, -1], 9, br(2026, 10, 15, 7), null)).toBeNull();
  });
});
