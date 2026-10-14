import type { Oferta } from "./shopee";

/** Teto de produtos por lote: a Shopee não informa limites de consulta e a revisão humana precisa caber no dia. */
export const MAX_LOTE = 30;

export type FiltrosLote = { vendasMin: number; descontoMin: number; comissaoMin: number; notaMin: number };

export const FILTROS_PADRAO: FiltrosLote = { vendasMin: 50, descontoMin: 0, comissaoMin: 0, notaMin: 4 };

/** Lê um número de filtro vindo da URL: vazio ou inválido vira o padrão; sempre dentro de [0, max]. */
export function lerFiltro(valor: string | undefined, padrao: number, max: number): number {
  if (valor === undefined || valor.trim() === "") return padrao;
  const n = Number(valor.replace(",", "."));
  if (!Number.isFinite(n)) return padrao;
  return Math.min(Math.max(n, 0), max);
}

/** Dado que a Shopee não informou não passa em filtro que exige aquele dado. */
export function passaNosFiltros(o: Oferta, f: FiltrosLote): boolean {
  if (f.vendasMin > 0 && (o.vendas ?? 0) < f.vendasMin) return false;
  if (f.descontoMin > 0 && (o.desconto ?? 0) < f.descontoMin) return false;
  if (f.comissaoMin > 0 && (o.comissao ?? 0) < f.comissaoMin) return false;
  if (f.notaMin > 0 && (o.nota ?? 0) < f.notaMin) return false;
  return true;
}

export const ORDENS_LOTE = [
  { valor: "vendas", rotulo: "Mais vendidos" },
  { valor: "desconto", rotulo: "Maior desconto (entre os buscados)" },
  { valor: "comissao", rotulo: "Maior comissão" },
  { valor: "menor-preco", rotulo: "Menor preço" },
  { valor: "relevancia", rotulo: "Mais relevantes" },
] as const;
export type OrdemLote = (typeof ORDENS_LOTE)[number]["valor"];
export const ehOrdemLote = (v: string): v is OrdemLote => ORDENS_LOTE.some((o) => o.valor === v);

/** A Shopee não ordena por desconto: busca por vendas e reordena aqui, só entre os produtos buscados. */
export const ordemParaShopee = (o: OrdemLote) => (o === "desconto" ? "vendas" : o);

export function ordenarLocal(ofertas: Oferta[], ordem: OrdemLote): Oferta[] {
  if (ordem !== "desconto") return ofertas;
  return [...ofertas].sort((a, b) => (b.desconto ?? 0) - (a.desconto ?? 0));
}

// ---------------------------------------------------------------------------
// Lista de bloqueio (vale só na publicação direta)
// ---------------------------------------------------------------------------
/**
 * Termos de produtos que NÃO devem ir ao ar sem uma pessoa olhar (restritos pela Shopee ou de risco).
 * Na publicação direta, o produto com um destes termos no nome entra como rascunho. Não substitui a revisão
 * nem as regras da Shopee: confira o programa de afiliados. Para ampliar a lista, acrescente termos aqui.
 */
export const TERMOS_BLOQUEADOS = [
  "arma",
  "armas",
  "arma de fogo",
  "municao",
  "taser",
  "soco ingles",
  "spray de pimenta",
  "cigarro",
  "cigarro eletronico",
  "vape",
  "narguile",
  "essencia para narguile",
  "anabolizante",
  "esteroide",
  "hormonio",
  "remedio",
  "medicamento",
  "abortivo",
  "emagrecedor",
  "sibutramina",
  "viagra",
  "cannabis",
  "maconha",
  "produto adulto",
] as const;

const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const REGEX_BLOQUEIO = new RegExp(`(?<![a-z0-9])(?:${TERMOS_BLOQUEADOS.map((t) => escapar(t)).join("|")})(?![a-z0-9])`);

export const nomeBloqueado = (nome: string) => REGEX_BLOQUEIO.test(semAcento(nome));
