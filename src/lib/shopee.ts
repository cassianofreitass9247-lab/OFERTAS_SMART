import { DOMINIOS_AFILIADO, linkAfiliadoValido } from "./produto";

/**
 * Adaptador da Shopee Affiliate Open API (GraphQL).
 *
 * Variáveis do Worker (Cloudflare > Workers > ofertasmart > Settings > Variables and Secrets):
 *   SHOPEE_APP_ID  AppID da Open API (tipo Text)
 *   SHOPEE_SECRET  Secret da Open API (tipo Secret; nunca no GitHub, no chat ou em NEXT_PUBLIC_*)
 *
 * Autenticação (documentação da Shopee Open API):
 *   Authorization: SHA256 Credential={AppID}, Timestamp={segundos}, Signature={hex}
 *   Signature = SHA256(AppID + Timestamp + corpo JSON + Secret), sem separadores.
 *
 * O Secret entra só no cálculo da assinatura. Nenhuma mensagem de erro, log ou resposta o inclui.
 */

const URL_PADRAO = "https://open-api.affiliate.shopee.com.br/graphql";
const TEMPO_MS = 10_000;

type Ambiente = Record<string, string | undefined>;
type Busca = (url: string, init: RequestInit) => Promise<Response>;

export function configShopee(env: Ambiente = process.env) {
  const appId = (env.SHOPEE_APP_ID ?? "").trim();
  const secret = (env.SHOPEE_SECRET ?? "").trim();
  return { appId, secret, ativo: Boolean(appId && secret), incompleto: Boolean(appId) !== Boolean(secret) };
}

/** Só para testes locais: aponta para um emulador em 127.0.0.1. Qualquer outro valor é ignorado. */
function urlDaApi(env: Ambiente) {
  const v = env.SHOPEE_API_URL ?? "";
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(v) ? v : URL_PADRAO;
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------
export class ErroShopee extends Error {
  constructor(
    public readonly codigo: number | null,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroShopee";
  }
}

const MENSAGENS: Record<number, string> = {
  10020:
    "A Shopee recusou as credenciais. Confira se SHOPEE_APP_ID e SHOPEE_SECRET estão certos e sem espaços, e se o aplicativo está ativo no portal de afiliados.",
  10030: "Limite de consultas da Shopee atingido. Aguarde alguns minutos e tente de novo.",
  10031: "A Shopee negou o acesso a esta consulta.",
  10032: "A Shopee não reconheceu o ID de afiliado desta conta.",
  10033: "A conta de afiliado aparece como congelada na Shopee. Veja o portal de afiliados.",
  10034: "A conta de afiliado aparece em lista de bloqueio na Shopee. Veja o portal de afiliados.",
  10035: "Esta conta ainda não tem acesso à Open API. Confira no portal de afiliados se a liberação foi concluída.",
  11000: "A Shopee devolveu um erro de negócio. Tente de novo em instantes.",
  11002: "A Shopee informou um problema com a conta de afiliado vinculada.",
};

function erroDaResposta(erros: unknown): ErroShopee {
  const primeiro = Array.isArray(erros) ? (erros[0] as Record<string, unknown> | undefined) : undefined;
  const ext = (primeiro?.extensions ?? {}) as Record<string, unknown>;
  const bruto = ext.code ?? primeiro?.code;
  const codigo = typeof bruto === "number" ? bruto : typeof bruto === "string" && /^\d+$/.test(bruto) ? Number(bruto) : null;
  const motivo = String(ext.message ?? primeiro?.message ?? "").replace(/[\r\n]+/g, " ").slice(0, 200);
  if (codigo === 11001) return new ErroShopee(codigo, `A Shopee recusou os parâmetros da consulta${motivo ? `: ${motivo}` : "."}`);
  if (codigo !== null && MENSAGENS[codigo]) return new ErroShopee(codigo, MENSAGENS[codigo]);
  return new ErroShopee(codigo, `A Shopee devolveu um erro${codigo ? ` (código ${codigo})` : ""}${motivo ? `: ${motivo}` : "."}`);
}

// ---------------------------------------------------------------------------
// Chamada autenticada
// ---------------------------------------------------------------------------
async function sha256Hex(texto: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const assinar = (appId: string, secret: string, timestamp: number, corpo: string) => sha256Hex(`${appId}${timestamp}${corpo}${secret}`);

export async function consultarShopee(
  query: string,
  opcoes: { env?: Ambiente; buscar?: Busca; agora?: () => number } = {},
): Promise<Record<string, unknown>> {
  const env = opcoes.env ?? process.env;
  const cfg = configShopee(env);
  if (!cfg.ativo) throw new ErroShopee(null, "A integração com a Shopee não está configurada: cadastre SHOPEE_APP_ID e SHOPEE_SECRET no Worker.");

  const corpo = JSON.stringify({ query });
  const timestamp = Math.floor((opcoes.agora?.() ?? Date.now()) / 1000);
  const assinatura = await assinar(cfg.appId, cfg.secret, timestamp, corpo);

  let resposta: Response;
  try {
    resposta = await (opcoes.buscar ?? fetch)(urlDaApi(env), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `SHA256 Credential=${cfg.appId}, Timestamp=${timestamp}, Signature=${assinatura}`,
      },
      body: corpo,
      signal: AbortSignal.timeout(TEMPO_MS),
    });
  } catch {
    throw new ErroShopee(null, "Não foi possível falar com a Shopee agora (sem resposta). Tente de novo em instantes.");
  }

  let json: { data?: Record<string, unknown> | null; errors?: unknown } | null = null;
  try {
    json = await resposta.json();
  } catch {
    // corpo que não é JSON
  }
  if (json?.errors) throw erroDaResposta(json.errors);
  if (!resposta.ok || !json?.data) {
    throw new ErroShopee(null, `A Shopee respondeu com um erro inesperado (HTTP ${resposta.status}).`);
  }
  return json.data;
}

// ---------------------------------------------------------------------------
// Ofertas de produto (productOfferV2)
// ---------------------------------------------------------------------------
export type Oferta = {
  itemId: string;
  shopId: string;
  nome: string;
  imagemUrl: string | null;
  precoMin: number | null;
  precoMax: number | null;
  /** Comissão em %, como a Shopee informa (ex.: 8.5). */
  comissao: number | null;
  vendas: number | null;
  nota: number | null;
  /** Desconto em %, como a Shopee informa. */
  desconto: number | null;
  loja: string | null;
  linkProduto: string | null;
  linkAfiliado: string | null;
};

const CAMPOS =
  "itemId shopId productName imageUrl priceMin priceMax commissionRate sales ratingStar priceDiscountRate shopName productLink offerLink";

const ordens = { relevancia: 1, vendas: 2, "menor-preco": 4, comissao: 5 } as const;
export type Ordem = keyof typeof ordens;
export const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: "relevancia", rotulo: "Mais relevantes" },
  { valor: "vendas", rotulo: "Mais vendidos" },
  { valor: "comissao", rotulo: "Maior comissão" },
  { valor: "menor-preco", rotulo: "Menor preço" },
];
export const ehOrdem = (v: string): v is Ordem => v in ordens;

const ehId = (v: string) => /^\d{1,19}$/.test(v);

const numero = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && /^\s*\d+(\.\d+)?\s*$/.test(v)) return Number(v);
  return null;
};
const texto = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const idDe = (v: unknown): string | null => {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  return ehId(s) ? s : null;
};
const https = (v: unknown, max = 2000) => {
  const t = texto(v, max);
  return t && /^https:\/\//i.test(t) ? t : null;
};

/** A Shopee pode informar a taxa como fração ("0.085") ou como percentual ("8.5"): abaixo de 1 é fração. */
const percentual = (v: unknown) => {
  const n = numero(v);
  if (n === null || n < 0) return null;
  return Math.round((n < 1 ? n * 100 : n) * 100) / 100;
};

export function normalizarOferta(no: unknown): Oferta | null {
  if (!no || typeof no !== "object") return null;
  const o = no as Record<string, unknown>;
  const itemId = idDe(o.itemId);
  const shopId = idDe(o.shopId);
  const nome = texto(o.productName, 300);
  if (!itemId || !shopId || !nome) return null;
  return {
    itemId,
    shopId,
    nome,
    imagemUrl: https(o.imageUrl),
    precoMin: numero(o.priceMin),
    precoMax: numero(o.priceMax),
    comissao: percentual(o.commissionRate),
    vendas: numero(o.sales),
    nota: numero(o.ratingStar),
    desconto: numero(o.priceDiscountRate),
    loja: texto(o.shopName, 120),
    linkProduto: https(o.productLink),
    linkAfiliado: https(o.offerLink),
  };
}

type Opcoes = { env?: Ambiente; buscar?: Busca; agora?: () => number };

function extrairOfertas(dados: Record<string, unknown>): Oferta[] {
  const nos = (dados.productOfferV2 as { nodes?: unknown[] } | null | undefined)?.nodes;
  if (!Array.isArray(nos)) throw new ErroShopee(null, "A resposta da Shopee veio num formato inesperado.");
  return nos.map(normalizarOferta).filter((o): o is Oferta => o !== null);
}

export async function buscarOfertaPorItem(itemId: string, shopId: string | null, opcoes: Opcoes = {}): Promise<Oferta | null> {
  if (!ehId(itemId) || (shopId !== null && !ehId(shopId))) throw new ErroShopee(null, "Identificador de produto inválido.");
  const args = [`itemId: ${itemId}`, shopId ? `shopId: ${shopId}` : null, "limit: 1"].filter(Boolean).join(", ");
  const dados = await consultarShopee(`{ productOfferV2(${args}) { nodes { ${CAMPOS} } } }`, opcoes);
  return extrairOfertas(dados)[0] ?? null;
}

export const OFERTAS_POR_PAGINA = 10;

export async function buscarOfertas(
  entrada: { termo: string; ordem?: Ordem; pagina?: number; permitirVazio?: boolean },
  opcoes: Opcoes = {},
): Promise<{ ofertas: Oferta[]; temMais: boolean }> {
  // Remove caracteres de controle e limita o tamanho; JSON.stringify gera o texto entre aspas já escapado.
  const termo = entrada.termo.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  if (termo.length < 2 && !(termo === "" && entrada.permitirVazio)) throw new ErroShopee(null, "Digite pelo menos 2 letras para buscar.");
  const pagina = Math.min(Math.max(Math.trunc(entrada.pagina ?? 1), 1), 50);
  const sort = ordens[entrada.ordem ?? "relevancia"];
  const args = [termo ? `keyword: ${JSON.stringify(termo)}` : null, `sortType: ${sort}`, `page: ${pagina}`, `limit: ${OFERTAS_POR_PAGINA}`].filter(Boolean).join(", ");
  const dados = await consultarShopee(`{ productOfferV2(${args}) { nodes { ${CAMPOS} } } }`, opcoes);
  const ofertas = extrairOfertas(dados);
  return { ofertas, temMais: ofertas.length >= OFERTAS_POR_PAGINA };
}

/** Páginas lidas por busca em lote (a Shopee não informa o limite de consultas: poucas e em sequência). */
export const PAGINAS_POR_BUSCA_EM_LOTE = 5;

/**
 * Lê até `paginas` páginas seguidas a partir de `de`, uma de cada vez. Se uma página falhar depois de a primeira
 * ter vindo, devolve o que já tem junto com o aviso, em vez de perder tudo.
 */
export async function buscarVariasPaginas(
  entrada: { termo: string; ordem?: Ordem; de?: number; paginas?: number },
  opcoes: Opcoes = {},
): Promise<{ ofertas: Oferta[]; proximaPagina: number | null; aviso?: string }> {
  const de = Math.min(Math.max(Math.trunc(entrada.de ?? 1), 1), 50);
  const total = Math.min(Math.max(Math.trunc(entrada.paginas ?? PAGINAS_POR_BUSCA_EM_LOTE), 1), PAGINAS_POR_BUSCA_EM_LOTE);
  const vistos = new Set<string>();
  const ofertas: Oferta[] = [];
  let proxima: number | null = de;
  for (let i = 0; i < total && proxima !== null; i++) {
    try {
      const r = await buscarOfertas({ termo: entrada.termo, ordem: entrada.ordem, pagina: proxima, permitirVazio: true }, opcoes);
      for (const o of r.ofertas) {
        if (!vistos.has(o.itemId)) {
          vistos.add(o.itemId);
          ofertas.push(o);
        }
      }
      proxima = r.temMais && proxima < 50 ? proxima + 1 : null;
    } catch (e) {
      if (i === 0) throw e;
      return { ofertas, proximaPagina: proxima, aviso: `A busca parou na página ${proxima}: ${e instanceof Error ? e.message : "erro"}` };
    }
  }
  return { ofertas, proximaPagina: proxima };
}

// ---------------------------------------------------------------------------
// Link de afiliado com identificadores (generateShortLink)
// ---------------------------------------------------------------------------
/** A Shopee aceita até 5 subIds; ficam no link e voltam no relatório de conversões (atribuição de comissão). */
export const MAX_SUBIDS = 5;

/**
 * Gera o link curto de afiliado de uma página da Shopee, com subIds (só letras e números, até 5).
 * Só aceita endereço https de shopee.com.br ou shope.ee; o link devolvido também é conferido.
 */
export async function gerarLinkCurto(originUrl: string, subIds: string[] = [], opcoes: Opcoes = {}): Promise<string> {
  let origem: URL;
  try {
    origem = new URL(originUrl);
  } catch {
    throw new ErroShopee(null, "Endereço de produto inválido.");
  }
  if (!doDominioShopee(origem)) throw new ErroShopee(null, "Só é possível gerar link para páginas da Shopee Brasil.");
  const ids = subIds.map((s) => s.replace(/[^A-Za-z0-9]/g, "").slice(0, 40)).filter(Boolean).slice(0, MAX_SUBIDS);
  const lista = ids.length ? `, subIds: [${ids.map((s) => JSON.stringify(s)).join(", ")}]` : "";
  const dados = await consultarShopee(
    `mutation { generateShortLink(input: { originUrl: ${JSON.stringify(origem.toString())}${lista} }) { shortLink } }`,
    opcoes,
  );
  const link = (dados.generateShortLink as { shortLink?: unknown } | null | undefined)?.shortLink;
  if (typeof link !== "string" || !linkAfiliadoValido(link)) throw new ErroShopee(null, "A Shopee não devolveu um link de afiliado válido.");
  return link;
}

// ---------------------------------------------------------------------------
// Link de produto -> IDs (inclui links curtos, com redirecionamento controlado)
// ---------------------------------------------------------------------------
export type AlvoShopee =
  | { tipo: "item"; itemId: string; shopId: string | null }
  | { tipo: "curto"; url: string }
  | { tipo: "palavra"; termo: string }
  | { tipo: "erro"; erro: string };

const doDominioShopee = (u: URL) => {
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const host = u.hostname.toLowerCase();
  return DOMINIOS_AFILIADO.some((d) => host === d || host.endsWith("." + d));
};

const decodificar = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Formatos conhecidos: ...-i.{loja}.{produto}  |  /product/{loja}/{produto}  |  /opaanlp/{loja}/{produto} */
export function extrairIds(endereco: string): { shopId: string; itemId: string } | null {
  const t = decodificar(decodificar(endereco));
  const m = /-i\.(\d{1,19})\.(\d{1,19})/.exec(t) ?? /\/(?:product|opaanlp)\/(\d{1,19})\/(\d{1,19})/.exec(t);
  return m ? { shopId: m[1], itemId: m[2] } : null;
}

export function interpretarEntrada(entrada: string): AlvoShopee {
  const t = entrada.trim();
  if (!t) return { tipo: "erro", erro: "Cole o link do produto na Shopee, o ID do produto ou digite o que procura." };
  if (/^\d{1,19}$/.test(t)) return { tipo: "item", itemId: t, shopId: null };

  const achado = /https?:\/\/[^\s"'<>]+/i.exec(t);
  if (achado) {
    let u: URL;
    try {
      u = new URL(achado[0]);
    } catch {
      return { tipo: "erro", erro: "Esse link não parece válido." };
    }
    if (!doDominioShopee(u)) return { tipo: "erro", erro: "Cole um link https da Shopee Brasil (shopee.com.br ou shope.ee)." };
    const ids = extrairIds(u.toString());
    if (ids) return { tipo: "item", ...ids };
    return { tipo: "curto", url: u.toString() };
  }
  return { tipo: "palavra", termo: t };
}

const ERRO_CURTO =
  "Não consegui ler este link curto. Abra o produto no navegador e copie o endereço completo da página, ou cole só o número do produto.";

/**
 * Segue o redirecionamento de um link curto (s.shopee.com.br, shope.ee) até achar os IDs do produto.
 * Segurança (SSRF): só busca endereços https de shopee.com.br ou shope.ee, sem porta nem credenciais; cada salto é
 * conferido antes de ser seguido; no máximo 4 saltos e 6 s por busca.
 */
export async function resolverLinkCurto(url: string, buscar: Busca = fetch): Promise<{ shopId: string; itemId: string } | { erro: string }> {
  let atual: URL;
  try {
    atual = new URL(url);
  } catch {
    return { erro: ERRO_CURTO };
  }
  try {
    for (let salto = 0; salto < 4; salto++) {
      if (!doDominioShopee(atual)) return { erro: ERRO_CURTO };
      const r = await buscar(atual.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; VitrineDaMoni/1.0)", accept: "text/html" },
      });
      const destino = r.headers.get("location");
      if (![301, 302, 303, 307, 308].includes(r.status) || !destino) return { erro: ERRO_CURTO };
      const proximo = new URL(destino, atual);
      const ids = extrairIds(proximo.toString());
      if (ids) return ids;
      atual = proximo;
    }
  } catch {
    return { erro: ERRO_CURTO };
  }
  return { erro: ERRO_CURTO };
}

// ---------------------------------------------------------------------------
// Preço e comissão para exibição
// ---------------------------------------------------------------------------
/** Preço que vira "preço atual" do produto: o menor entre as variações. */
export const precoDaOferta = (o: Oferta) => (o.precoMin !== null && o.precoMin > 0 ? Math.round(o.precoMin * 100) / 100 : null);
