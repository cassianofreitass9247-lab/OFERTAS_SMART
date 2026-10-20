import { describe, expect, it, vi } from "vitest";
import { enderecoDoPedido, escolherOpcoes, mensagemOpcoes, prepararOpcoes, subIdsDoPedido, termoDeBusca, termoDoProduto, type DepsOpcoes } from "@/lib/pedido-opcoes";
import type { Oferta } from "@/lib/shopee";

let n = 0;
const oferta = (extra: Partial<Oferta> = {}): Oferta => {
  n++;
  return {
    itemId: String(1000 + n), shopId: "77", nome: `Mochila infantil modelo ${n}`, imagemUrl: "https://down-br.img.susercontent.com/file/" + n,
    precoMin: 50, precoMax: 60, comissao: 8, vendas: 100, nota: 4.7, desconto: 5, loja: "Loja", linkProduto: `https://shopee.com.br/product/77/${1000 + n}`,
    linkAfiliado: `https://s.shopee.com.br/OFR${n}`, ...extra,
  };
};

describe("termoDeBusca", () => {
  it("tira as palavras de enchimento e limita a 6 palavras", () => {
    expect(termoDeBusca("Quero uma mochila rosa de rodinha pra minha filha")).toBe("mochila rosa rodinha filha");
    expect(termoDeBusca("Procuro um fone bluetooth com cancelamento de ruído, tipo AirPods, bem barato, para correr")).toBe("fone bluetooth cancelamento ruído airpods barato");
  });
  it("ignora links e repetições; cai no texto original se sobrar pouco", () => {
    expect(termoDeBusca("panela panela https://shopee.com.br/x-i.1.2 antiaderente")).toBe("panela antiaderente");
    expect(termoDeBusca("quero um")).toBe("quero um");
  });
  it("termoDoProduto usa as primeiras palavras do nome", () => {
    expect(termoDoProduto("Air Fryer 4L Digital [Preta] Frete Grátis Promoção Hoje Oferta")).toBe("Air Fryer 4L Digital Preta Frete");
  });
});

describe("escolherOpcoes", () => {
  it("escolhe opções variadas, sem repetir produto, cada uma com seu rótulo", () => {
    const parecido = oferta({ vendas: 50, nota: 4.5, precoMin: 80 });
    const vendido = oferta({ vendas: 9000, nota: 4.6, precoMin: 70 });
    const avaliado = oferta({ vendas: 300, nota: 4.95, precoMin: 90 });
    const barato = oferta({ vendas: 40, nota: 4.5, precoMin: 25 });
    const desconto = oferta({ vendas: 80, nota: 4.4, precoMin: 60, desconto: 45 });
    const r = escolherOpcoes([parecido, vendido, avaliado, barato, desconto]);
    expect(r.map((x) => x.rotulo)).toEqual(["Mais parecido com o seu pedido", "Mais vendido", "Melhor avaliado", "Mais barato", "Maior desconto"]);
    expect(r.map((x) => x.oferta)).toEqual([parecido, vendido, avaliado, barato, desconto]);
    expect(new Set(r.map((x) => x.oferta.itemId)).size).toBe(5);
  });

  it("o selo nunca mente: o produto mais barato leva 'Mais barato', mesmo se também for o mais vendido", () => {
    const parecido = oferta({ vendas: 71, nota: 4.7, precoMin: 33 });
    const vendidoEBarato = oferta({ vendas: 5668, nota: 4.7, precoMin: 16.97 });
    const avaliado = oferta({ vendas: 1631, nota: 4.9, precoMin: 46.03 });
    const outro = oferta({ vendas: 3084, nota: 4.7, precoMin: 20.97 });
    const r = escolherOpcoes([parecido, vendidoEBarato, avaliado, outro]);
    const dele = r.find((x) => x.oferta === vendidoEBarato);
    expect(dele?.rotulo).toBe("Mais vendido e mais barato");
    // nenhum outro produto se diz "mais barato"
    expect(r.filter((x) => /mais barato/i.test(x.rotulo))).toHaveLength(1);
    expect(r.map((x) => x.oferta.itemId)).toEqual([...new Set(r.map((x) => x.oferta.itemId))]);
    // a vaga que sobrou vira "Outra opção", sem selo falso
    expect(r.find((x) => x.oferta === outro)?.rotulo).toBe("Outra opção");
    expect(r).toHaveLength(4);
  });

  it("produto único com vários selos aparece uma vez, com no máximo dois selos", () => {
    const a = oferta({ vendas: 9000, nota: 4.9, precoMin: 20, desconto: 40 });
    const r = escolherOpcoes([a]);
    expect(r).toHaveLength(1);
    expect(r[0].oferta).toBe(a);
    expect(r[0].rotulo).toBe("Mais vendido, melhor avaliado e mais barato");
    expect(r[0].rotulo.length).toBeLessThanOrEqual(60);
  });

  it("'maior desconto' exige histórico de vendas; sem isso, o selo não é dado", () => {
    const normal = oferta({ vendas: 500, desconto: 5 });
    const promoSemHistorico = oferta({ vendas: 4, desconto: 60 });
    const r = escolherOpcoes([normal, promoSemHistorico]);
    expect(r.find((x) => x.rotulo === "Maior desconto")).toBeUndefined();
    const comHistorico = oferta({ vendas: 300, desconto: 60, precoMin: 90 });
    expect(escolherOpcoes([normal, comHistorico]).find((x) => x.rotulo === "Maior desconto")?.oferta).toBe(comHistorico);
  });

  it("'mais barato' ignora anúncio sem histórico de vendas", () => {
    const normal = oferta({ vendas: 800, precoMin: 100, nota: 4.8 });
    const baratoSemVenda = oferta({ vendas: 2, precoMin: 5, nota: 4.8 });
    const r = escolherOpcoes([normal, baratoSemVenda]);
    expect(r.find((x) => /mais barato/i.test(x.rotulo))?.oferta).toBe(normal);
  });

  it("descarta nota baixa, preço ausente, repetidos e anúncios com o mesmo título", () => {
    const boa = oferta();
    const ruim = oferta({ nota: 3.2 });
    const semPreco = oferta({ precoMin: null });
    const dupId = { ...boa };
    const mesmoTitulo = oferta({ nome: boa.nome });
    const r = escolherOpcoes([ruim, semPreco, boa, dupId, mesmoTitulo]);
    expect(r.map((x) => x.oferta)).toEqual([boa]);
  });

  it("'mais barato' ignora produto de nota abaixo de 4,3", () => {
    const normal = oferta({ precoMin: 100, nota: 4.8 });
    const baratoRuim = oferta({ precoMin: 5, nota: 4.1, vendas: 500 });
    const r = escolherOpcoes([normal, baratoRuim]);
    expect(r.find((x) => /mais barato/i.test(x.rotulo))?.oferta).toBe(normal);
    expect(r).toHaveLength(2);
  });

  it("o produto do link vem primeiro e sobrevive mesmo com nota baixa", () => {
    const doLink = oferta({ nota: 3.9 });
    const outro = oferta();
    const r = escolherOpcoes([doLink, outro], { doLink });
    expect(r[0].oferta).toBe(doLink);
    expect(r[0].rotulo).toMatch(/^O produto do seu link/);
  });

  it("respeita o máximo de 5 e devolve vazio sem candidatas", () => {
    const muitas = () => Array.from({ length: 12 }, (_, i) => oferta({ vendas: 100 + i, desconto: i === 11 ? 30 : 5 }));
    expect(escolherOpcoes(muitas()).length).toBeLessThanOrEqual(5);
    expect(escolherOpcoes(muitas(), { max: 3 }).length).toBeLessThanOrEqual(3);
    expect(escolherOpcoes([])).toEqual([]);
  });
});

describe("prepararOpcoes", () => {
  const pedido = { id: "11111111-2222-3333-4444-555555555555", descricao: "Quero uma mochila rosa de rodinha", referencia_url: null };
  const deps = (extra: Partial<DepsOpcoes> = {}): DepsOpcoes => ({
    buscarOfertas: vi.fn(async (_t: string, ordem) => (ordem === "vendas" ? [oferta({ vendas: 8000 })] : [oferta(), oferta({ precoMin: 20 })])),
    ofertaPorLink: vi.fn(async () => null),
    gerarLink: vi.fn(async (_u: string, ids: string[]) => `https://s.shopee.com.br/G${ids[2]}`),
    ...extra,
  });

  it("busca por relevância e vendas, gera o link de cada opção com os identificadores do pedido", async () => {
    const d = deps();
    const r = await prepararOpcoes(pedido, null, d);
    expect(r.termo).toBe("mochila rosa rodinha");
    expect(d.buscarOfertas).toHaveBeenCalledWith("mochila rosa rodinha", "relevancia");
    expect(d.buscarOfertas).toHaveBeenCalledWith("mochila rosa rodinha", "vendas");
    expect(r.opcoes.length).toBeGreaterThanOrEqual(3);
    expect(r.opcoes.map((o) => o.link_afiliado)).toEqual(r.opcoes.map((_, i) => `https://s.shopee.com.br/Go${i + 1}`));
    expect(d.gerarLink).toHaveBeenCalledWith(expect.stringContaining("https://shopee.com.br/product/"), ["pedido", "p111111112222", "o1"]);
    expect(JSON.stringify(vi.mocked(d.gerarLink).mock.calls)).not.toMatch(/Ana|8498/); // sem dado pessoal nos identificadores
    expect(r.opcoes[0].id_externo).toMatch(/^77\.\d+$/);
  });

  it("termo manual vence o automático", async () => {
    const d = deps();
    const r = await prepararOpcoes(pedido, "  mochila   escolar rosa ", d);
    expect(r.termo).toBe("mochila escolar rosa");
  });

  it("com link de exemplo da Shopee, o produto entra primeiro e a busca usa o nome dele", async () => {
    const dele = oferta({ nome: "Mochila Rodinha Rosa Menina Escolar 360 Graus Grande" });
    const d = deps({ ofertaPorLink: vi.fn(async () => dele) });
    const r = await prepararOpcoes({ ...pedido, referencia_url: "https://s.shopee.com.br/abc" }, null, d);
    expect(r.opcoes[0].rotulo).toBe("O produto do seu link");
    expect(r.opcoes[0].nome).toBe(dele.nome);
    expect(r.termo).toBe("Mochila Rodinha Rosa Menina Escolar 360");
  });

  it("falha ao ler o link de exemplo não impede a busca", async () => {
    const d = deps({ ofertaPorLink: vi.fn(async () => { throw new Error("x"); }) });
    const r = await prepararOpcoes({ ...pedido, referencia_url: "https://s.shopee.com.br/abc" }, null, d);
    expect(r.opcoes.length).toBeGreaterThan(0);
  });

  it("se generateShortLink falhar, usa o link do anúncio (afiliado, sem identificador) e avisa", async () => {
    const d = deps({ gerarLink: vi.fn(async () => { throw new Error("recusou"); }) });
    const r = await prepararOpcoes(pedido, null, d);
    expect(r.opcoes.length).toBeGreaterThan(0);
    expect(r.opcoes.every((o) => /^https:\/\/s\.shopee\.com\.br\/OFR\d+$/.test(o.link_afiliado))).toBe(true);
    expect(r.resumo).toMatch(/sem identificador/);
  });

  it("opção sem nenhum link de afiliado é descartada", async () => {
    const d = deps({
      buscarOfertas: vi.fn(async () => [oferta({ linkAfiliado: null })]),
      gerarLink: vi.fn(async () => { throw new Error("recusou"); }),
    });
    const r = await prepararOpcoes(pedido, null, d);
    expect(r.opcoes).toEqual([]);
    expect(r.resumo).toMatch(/Nenhuma opção/);
  });

  it("se as duas buscas falharem (e não há link), o erro sobe; se só uma falhar, segue", async () => {
    const falha = new Error("Shopee fora do ar");
    await expect(prepararOpcoes(pedido, null, deps({ buscarOfertas: vi.fn(async () => { throw falha; }) }))).rejects.toBe(falha);
    const meia = deps({ buscarOfertas: vi.fn(async (_t: string, ordem) => { if (ordem === "vendas") throw falha; return [oferta(), oferta(), oferta()]; }) });
    expect((await prepararOpcoes(pedido, null, meia)).opcoes.length).toBeGreaterThanOrEqual(3);
  });
});

describe("subIds e mensagem", () => {
  it("identificadores só com letras e números e sem dado pessoal", () => {
    expect(subIdsDoPedido("11111111-2222-3333-4444-555555555555", 3)).toEqual(["pedido", "p111111112222", "o3"]);
  });
  it("mensagem com o link da página e o aviso de afiliado", () => {
    const url = enderecoDoPedido("https://ofertasmart.cfsolutions.workers.dev/", "a".repeat(32));
    expect(url).toBe(`https://ofertasmart.cfsolutions.workers.dev/pedido/${"a".repeat(32)}`);
    const m = mensagemOpcoes({ nome: "Ana Maria", descricao: "Mochila rosa", url, quantidade: 4 });
    expect(m).toContain("Oi, Ana!");
    expect(m).toContain("Separei 4 opções");
    expect(m).toContain(url);
    expect(m).toMatch(/afiliado/);
    expect(mensagemOpcoes({ nome: "Ana", descricao: "x", url, quantidade: 1 })).toContain("Separei 1 opção ");
  });
});

describe("formatarVendas", () => {
  it("formata em milhares", async () => {
    const { formatarVendas } = await import("@/lib/pedido-opcoes");
    expect(formatarVendas(1)).toBe("1 vendido");
    expect(formatarVendas(950)).toBe("950 vendidos");
    expect(formatarVendas(1234)).toBe("1,2 mil vendidos");
    expect(formatarVendas(12000)).toBe("12 mil vendidos");
  });
});

describe("formatarNota", () => {
  it("trunca em vez de arredondar para cima", async () => {
    const { formatarNota } = await import("@/lib/pedido-opcoes");
    expect(formatarNota(4.95)).toBe("4,9");
    expect(formatarNota(4.8)).toBe("4,8");
    expect(formatarNota(5)).toBe("5,0");
    expect(formatarNota(4.7)).toBe("4,7");
  });
});
