// Opções de produto para um pedido ("Pede pra Moni"): escolhe 3 a 5 produtos variados entre os resultados da Shopee
// e gera o link de afiliado de cada um com o identificador do pedido. As chamadas externas entram por parâmetro
// (deps), então a regra é testada sem rede.
import type { Oferta, Ordem } from "./shopee";
import { precoDaOferta } from "./shopee";
import { primeiroNome } from "./pedido";

export const MAX_OPCOES = 5;
export const MIN_OPCOES = 3;

export type OpcaoPronta = {
  rotulo: string;
  nome: string;
  imagem_url: string | null;
  preco: number | null;
  nota: number | null;
  vendas: number | null;
  loja: string | null;
  link_afiliado: string;
  id_externo: string;
};

// ---------------------------------------------------------------------------
// Termo de busca a partir do texto livre do pedido
// ---------------------------------------------------------------------------
const PALAVRAS_VAZIAS = new Set(
  (
    "a o as os um uma uns umas de da do das dos para pra pro com sem que e ou em no na nos nas por me minha meu minhas meus " +
    "quero queria quer procuro procurando preciso precisava gostaria achar encontrar algum alguma tem ter ser estar muito " +
    "bem bom boa favor tipo fazer comprar produto produtos mais mesmo como qual quais onde pedido presente"
  ).split(" "),
);

/** "Quero uma mochila rosa de rodinha pra minha filha" -> "mochila rosa rodinha filha" (até 6 palavras). */
export function termoDeBusca(descricao: string): string {
  const palavras = descricao
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 2 && !PALAVRAS_VAZIAS.has(p));
  const termo = [...new Set(palavras)].slice(0, 6).join(" ");
  return termo.length >= 2 ? termo : descricao.replace(/\s+/g, " ").trim().slice(0, 60);
}

/** Termo para achar alternativas a um produto: as primeiras palavras do nome dele. */
export const termoDoProduto = (nome: string) =>
  nome
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(" ");

// ---------------------------------------------------------------------------
// Escolha das opções
// ---------------------------------------------------------------------------
const NOTA_MINIMA = 4.0;
const NOTA_PARA_BARATO = 4.3;

const chaveNome = (nome: string) => nome.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 40);

type Escolhida = { oferta: Oferta; rotulo: string };

/**
 * `candidatas` vem na ordem de relevância da busca; a primeira, se `doLink`, é o produto que a cliente mandou.
 * Cada critério leva o melhor que ainda não foi escolhido, então o mesmo produto nunca aparece duas vezes e as
 * opções variam (parecida com o pedido, mais vendida, mais bem avaliada, mais barata, maior desconto).
 */
export function escolherOpcoes(candidatas: Oferta[], opcoes: { max?: number; doLink?: Oferta | null } = {}): Escolhida[] {
  const max = Math.min(opcoes.max ?? MAX_OPCOES, MAX_OPCOES);
  const vistos = new Set<string>();
  const nomes = new Set<string>();
  const validas: Oferta[] = [];
  for (const o of candidatas) {
    const preco = precoDaOferta(o);
    if (preco === null || vistos.has(o.itemId)) continue;
    if (o.nota !== null && o.nota < NOTA_MINIMA && o !== opcoes.doLink) continue;
    const nome = chaveNome(o.nome);
    if (nomes.has(nome)) continue; // anúncio repetido de outra loja com o mesmo título
    vistos.add(o.itemId);
    nomes.add(nome);
    validas.push(o);
  }

  const escolhidas: Escolhida[] = [];
  const usadas = new Set<string>();
  const levar = (o: Oferta | undefined, rotulo: string) => {
    if (!o || usadas.has(o.itemId) || escolhidas.length >= max) return;
    usadas.add(o.itemId);
    escolhidas.push({ oferta: o, rotulo });
  };
  const livres = () => validas.filter((o) => !usadas.has(o.itemId));
  const melhor = (lista: Oferta[], valor: (o: Oferta) => number | null, maior = true) => {
    let achado: Oferta | undefined;
    let v: number | null = null;
    for (const o of lista) {
      const x = valor(o);
      if (x === null) continue;
      if (v === null || (maior ? x > v : x < v)) {
        v = x;
        achado = o;
      }
    }
    return achado;
  };

  if (opcoes.doLink && validas.includes(opcoes.doLink)) levar(opcoes.doLink, "O produto do seu link");
  levar(livres()[0], "Mais parecido com o seu pedido");
  levar(melhor(livres(), (o) => (o.vendas && o.vendas > 0 ? o.vendas : null)), "Mais vendido");
  levar(
    melhor(
      livres().filter((o) => (o.vendas ?? 0) >= 10),
      (o) => (o.nota === null ? null : o.nota * 1000 + Math.min(o.vendas ?? 0, 999)),
    ),
    "Melhor avaliado",
  );
  levar(
    melhor(
      livres().filter((o) => o.nota === null || o.nota >= NOTA_PARA_BARATO),
      (o) => precoDaOferta(o),
      false,
    ),
    "Mais barato",
  );
  levar(melhor(livres(), (o) => (o.desconto && o.desconto >= 20 ? o.desconto : null)), "Maior desconto");
  // Poucas variações: completa com os próximos da busca até o mínimo.
  for (const o of livres()) {
    if (escolhidas.length >= Math.min(MIN_OPCOES, max)) break;
    levar(o, "Outra opção");
  }
  return escolhidas;
}

// ---------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------
export type DepsOpcoes = {
  buscarOfertas: (termo: string, ordem: Ordem) => Promise<Oferta[]>;
  /** Produto de um link da Shopee que a cliente mandou como exemplo; nulo se não for um produto. */
  ofertaPorLink: (referencia: string) => Promise<Oferta | null>;
  /** Link de afiliado com identificadores; lança erro se a Shopee recusar. */
  gerarLink: (originUrl: string, subIds: string[]) => Promise<string>;
};

export type ResultadoOpcoes = { termo: string; opcoes: OpcaoPronta[]; resumo: string };

/** Identificadores que vão no link (sem dado pessoal): o pedido e a posição da opção. */
export const subIdsDoPedido = (pedidoId: string, posicao: number) => ["pedido", `p${pedidoId.replace(/-/g, "").slice(0, 12)}`, `o${posicao}`];

export async function prepararOpcoes(
  pedido: { id: string; descricao: string; referencia_url: string | null },
  termoManual: string | null,
  deps: DepsOpcoes,
): Promise<ResultadoOpcoes> {
  let doLink: Oferta | null = null;
  if (pedido.referencia_url) doLink = await deps.ofertaPorLink(pedido.referencia_url).catch(() => null);

  const termo = (termoManual ?? "").replace(/\s+/g, " ").trim().slice(0, 100) || (doLink ? termoDoProduto(doLink.nome) : termoDeBusca(pedido.descricao));

  const [porRelevancia, porVendas] = await Promise.allSettled([deps.buscarOfertas(termo, "relevancia"), deps.buscarOfertas(termo, "vendas")]);
  if (porRelevancia.status === "rejected" && porVendas.status === "rejected" && !doLink) throw porRelevancia.reason;
  const candidatas = [
    ...(doLink ? [doLink] : []),
    ...(porRelevancia.status === "fulfilled" ? porRelevancia.value : []),
    ...(porVendas.status === "fulfilled" ? porVendas.value : []),
  ];

  const escolhidas = escolherOpcoes(candidatas, { doLink });
  const opcoes: OpcaoPronta[] = [];
  let semIdentificador = 0;
  for (const { oferta, rotulo } of escolhidas) {
    const origem = oferta.linkProduto ?? `https://shopee.com.br/product/${oferta.shopId}/${oferta.itemId}`;
    let link: string | null = null;
    try {
      link = await deps.gerarLink(origem, subIdsDoPedido(pedido.id, opcoes.length + 1));
    } catch {
      // Sem identificador a comissão não é atribuída ao pedido, mas o link do anúncio ainda é de afiliado.
      if (oferta.linkAfiliado) {
        link = oferta.linkAfiliado;
        semIdentificador++;
      }
    }
    if (!link) continue;
    opcoes.push({
      rotulo,
      nome: oferta.nome,
      imagem_url: oferta.imagemUrl,
      preco: precoDaOferta(oferta),
      nota: oferta.nota,
      vendas: oferta.vendas !== null ? Math.round(oferta.vendas) : null,
      loja: oferta.loja,
      link_afiliado: link,
      id_externo: `${oferta.shopId}.${oferta.itemId}`,
    });
  }

  const resumo = opcoes.length
    ? `${opcoes.length} opção(ões) para "${termo}"${semIdentificador ? `; ${semIdentificador} sem identificador do pedido (a Shopee recusou gerar o link)` : ""}.`
    : `Nenhuma opção encontrada para "${termo}".`;
  return { termo, opcoes, resumo };
}

// ---------------------------------------------------------------------------
// Mensagem de WhatsApp com o link da página do pedido
// ---------------------------------------------------------------------------
export const enderecoDoPedido = (siteUrl: string, token: string) => `${siteUrl.replace(/\/+$/, "")}/pedido/${token}`;

export function mensagemOpcoes(p: { nome: string; descricao: string; url: string; quantidade: number }): string {
  const resumo = p.descricao.replace(/\s+/g, " ").trim();
  return [
    `Oi, ${primeiroNome(p.nome)}! Aqui é a Moni, da Vitrine da Moni 🧡`,
    `Você me pediu: "${resumo.length > 120 ? resumo.slice(0, 119).trimEnd() + "…" : resumo}"`,
    "",
    `Separei ${p.quantidade} ${p.quantidade === 1 ? "opção" : "opções"} pra você escolher a que mais gostar:`,
    p.url,
    "",
    "Os links são de afiliado da Shopee: se você comprar por eles, posso ganhar uma comissão, sem custo extra pra você. Confira preço e frete na Shopee antes de fechar 😉",
  ].join("\n");
}

/** "950" -> "950 vendidos"; "1234" -> "1,2 mil vendidos". */
export function formatarVendas(n: number): string {
  if (n < 1000) return `${n} ${n === 1 ? "vendido" : "vendidos"}`;
  const mil = Math.round(n / 100) / 10;
  return `${String(mil).replace(".", ",")} mil vendidos`;
}
