// Local aproximado do clique, vindo da Cloudflare (estimativa pelo IP). O IP não é lido nem guardado aqui.

export type LocalClique = { pais: string | null; estado: string | null; cidade: string | null };

const SEM_LOCAL: LocalClique = { pais: null, estado: null, cidade: null };

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Lê país, estado e cidade do objeto `cf` da requisição. Qualquer campo pode faltar.
 * Valores fora do formato são descartados (o banco valida de novo).
 */
export function lerLocal(cf: unknown): LocalClique {
  if (!cf || typeof cf !== "object") return SEM_LOCAL;
  const o = cf as Record<string, unknown>;
  const pais = texto(o.country)?.toUpperCase() ?? null;
  if (!pais || !/^[A-Z]{2}$/.test(pais)) return SEM_LOCAL;
  const estadoBruto = texto(o.regionCode)?.toUpperCase() ?? null;
  const estado = estadoBruto && /^[A-Z0-9]{1,3}$/.test(estadoBruto) ? estadoBruto : null;
  // Sem controle de caracteres e com limite de tamanho. Nome da cidade pode ter acento e espaço.
  const cidade = texto(o.city)?.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80) || null;
  return { pais, estado, cidade };
}

/** "RN" no Brasil; "US/CA" fora do Brasil; "Sem local" quando não há país. */
export function rotuloEstado(pais: string | null, estado: string | null): string {
  if (!pais) return "Sem local";
  if (pais === "BR") return estado ?? "Brasil (sem estado)";
  return estado ? `${pais}/${estado}` : pais;
}

export function rotuloCidade(cidade: string, estado: string | null, pais: string | null): string {
  if (estado && pais === "BR") return `${cidade}, ${estado}`;
  return pais && pais !== "BR" ? `${cidade}, ${pais}` : cidade;
}

export type LocaisCliques = {
  total: number;
  com_local: number;
  por_estado: { pais: string; estado: string | null; cliques: number }[];
  por_cidade: { pais: string; estado: string | null; cidade: string; cliques: number }[];
};

/** Resposta crua da função cliques_locais para algo seguro de usar. Dado inesperado vira zeros. */
export function lerLocais(bruto: unknown): LocaisCliques {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const s = (v: unknown) => (typeof v === "string" && v ? v : null);
  const lista = <T,>(v: unknown, f: (x: Record<string, unknown>) => T | null): T[] =>
    Array.isArray(v) ? v.map((x) => (x && typeof x === "object" ? f(x as Record<string, unknown>) : null)).filter((x): x is T => x !== null) : [];
  return {
    total: n(o.total),
    com_local: n(o.com_local),
    por_estado: lista(o.por_estado, (x) => (s(x.pais) ? { pais: s(x.pais)!, estado: s(x.estado), cliques: n(x.cliques) } : null)),
    por_cidade: lista(o.por_cidade, (x) => (s(x.pais) && s(x.cidade) ? { pais: s(x.pais)!, estado: s(x.estado), cidade: s(x.cidade)!, cliques: n(x.cliques) } : null)),
  };
}
