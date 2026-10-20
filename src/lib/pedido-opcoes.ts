// Opções de produto para um pedido ("Pede pra Moni"): escolhe 3 a 5 produtos variados entre os resultados da Shopee
// e gera o link de afiliado de cada um com o identificador do pedido. As chamadas externas entram por parâmetro
// (deps), então a regra é testada sem rede.
import type { Oferta, Ordem } from "./shopee";
import { precoDaOferta } from "./shopee";
import { primeiroNome } from "./pedido";
import { F } from "./marca";

export const MAX_OPCOES = 5;

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
/** "Mais barato" não pode ser anúncio sem histórico; "maior desconto" exige histórico de verdade (desconto de anúncio novo engana). */
const VENDAS_PARA_BARATO = 20;
const VENDAS_PARA_DESCONTO = 50;
const DESCONTO_MINIMO = 20;
/** Sem critério suficiente, completa com "Outra opção" até este total. */
const ALVO_OPCOES = 4;

const chaveNome = (nome: string) => nome.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 40);

const ROTULO_PARECIDO = "Mais parecido com o seu pedido";

/** Um produto com vários selos: "Mais vendido, melhor avaliado e mais barato". "Mais parecido" some quando há selo mais informativo. */
function juntarRotulos(rotulos: string[]): string {
  const lista = rotulos.length > 1 ? rotulos.filter((r) => r !== ROTULO_PARECIDO) : rotulos;
  const usados: string[] = [];
  for (const r of lista) {
    const tentativa = [...usados, r];
    if (usados.length > 0 && (tentativa.length > 3 || montarRotulo(tentativa).length > 60)) break;
    usados.push(r);
  }
  return montarRotulo(usados);
}
const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
function montarRotulo(r: string[]): string {
  if (r.length === 1) return r[0];
  return `${[r[0], ...r.slice(1, -1).map(minuscula)].join(", ")} e ${minuscula(r[r.length - 1])}`;
}

type Escolhida = { oferta: Oferta; rotulo: string };

/**
 * `candidatas` vem na ordem de relevância da busca; a primeira, se `doLink`, é o produto que a cliente mandou.
 * Cada selo é calculado sobre TODOS os candidatos válidos, então ele nunca mente: "Mais barato" é o mais barato mesmo.
 * Quando o mesmo produto vence dois critérios, aparece uma vez só com os dois selos ("Mais vendido e mais barato");
 * as vagas que sobram não são preenchidas com "o segundo mais barato" (que teria selo falso), e sim com "Outra opção".
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

  // Vencedor de cada selo, na ordem em que aparecem.
  const vencedores: { oferta: Oferta | undefined; rotulo: string }[] = [
    { oferta: opcoes.doLink && validas.includes(opcoes.doLink) ? opcoes.doLink : undefined, rotulo: "O produto do seu link" },
    { oferta: validas.find((o) => o !== opcoes.doLink), rotulo: ROTULO_PARECIDO },
    { oferta: melhor(validas, (o) => (o.vendas && o.vendas > 0 ? o.vendas : null)), rotulo: "Mais vendido" },
    {
      oferta: melhor(
        validas.filter((o) => (o.vendas ?? 0) >= 10),
        // Nota primeiro (em décimos); só no empate de nota vale quem vendeu mais.
        (o) => (o.nota === null ? null : Math.round(o.nota * 10) * 1e7 + Math.min(o.vendas ?? 0, 9_999_999)),
      ),
      rotulo: "Melhor avaliado",
    },
    {
      oferta: melhor(
        validas.filter((o) => (o.nota === null || o.nota >= NOTA_PARA_BARATO) && (o.vendas === null || o.vendas >= VENDAS_PARA_BARATO)),
        (o) => precoDaOferta(o),
        false,
      ),
      rotulo: "Mais barato",
    },
    {
      oferta: melhor(
        validas.filter((o) => (o.vendas ?? 0) >= VENDAS_PARA_DESCONTO),
        (o) => (o.desconto && o.desconto >= DESCONTO_MINIMO ? o.desconto : null),
      ),
      rotulo: "Maior desconto",
    },
  ];

  const porProduto = new Map<string, { oferta: Oferta; rotulos: string[] }>();
  for (const { oferta, rotulo } of vencedores) {
    if (!oferta) continue;
    const atual = porProduto.get(oferta.itemId);
    if (atual) atual.rotulos.push(rotulo);
    else porProduto.set(oferta.itemId, { oferta, rotulos: [rotulo] });
  }
  const escolhidas: Escolhida[] = [...porProduto.values()].slice(0, max).map(({ oferta, rotulos }) => ({ oferta, rotulo: juntarRotulos(rotulos) }));

  // Poucos vencedores distintos: completa com os próximos da busca (preferindo os que têm histórico de vendas).
  const usados = new Set(escolhidas.map((e) => e.oferta.itemId));
  const alvo = Math.min(ALVO_OPCOES, max);
  for (const exigeVendas of [true, false]) {
    for (const o of validas) {
      if (escolhidas.length >= alvo) break;
      if (usados.has(o.itemId) || (exigeVendas && (o.vendas ?? 0) < VENDAS_PARA_BARATO)) continue;
      usados.add(o.itemId);
      escolhidas.push({ oferta: o, rotulo: "Outra opção" });
    }
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
    `Oi, ${primeiroNome(p.nome)}! Aqui é ${F.a}, ${F.doSite} 🧡`,
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

/** Nota com 1 casa, sempre para baixo: 4,95 vira "4,9" (arredondar para "5,0" prometeria mais do que a loja tem). */
export const formatarNota = (n: number) => (Math.floor(n * 10 + 1e-9) / 10).toFixed(1).replace(".", ",");
