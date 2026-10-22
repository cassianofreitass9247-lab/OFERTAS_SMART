// Prepara os números do Resumo do painel: completa os dias sem clique, nomeia dia da semana e horário
// e calcula as comparações. Funções puras, sem acesso ao banco.

export type ResumoCliques = {
  dias: number;
  total: number;
  anterior: number;
  por_dia: { dia: string; cliques: number }[];
  por_dia_semana: { dia: number; cliques: number }[];
  por_hora: { hora: number; cliques: number }[];
};

export const PERIODOS = [7, 30, 90] as const;
export type Periodo = (typeof PERIODOS)[number];

export function lerPeriodo(valor: string | string[] | undefined): Periodo {
  const v = Number(Array.isArray(valor) ? valor[0] : valor);
  return (PERIODOS as readonly number[]).includes(v) ? (v as Periodo) : 30;
}

const NOMES_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const CURTOS_DIA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Resposta crua da função do banco para algo seguro de usar. Dado inesperado vira zeros. */
export function lerResumo(bruto: unknown, dias: number): ResumoCliques {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const lista = <T,>(v: unknown, f: (x: Record<string, unknown>) => T | null): T[] =>
    Array.isArray(v) ? (v.map((x) => (x && typeof x === "object" ? f(x as Record<string, unknown>) : null)).filter((x): x is T => x !== null)) : [];
  return {
    dias: n(o.dias) || dias,
    total: n(o.total),
    anterior: n(o.anterior),
    por_dia: lista(o.por_dia, (x) => (typeof x.dia === "string" ? { dia: x.dia.slice(0, 10), cliques: n(x.cliques) } : null)),
    por_dia_semana: lista(o.por_dia_semana, (x) => ({ dia: n(x.dia), cliques: n(x.cliques) })),
    por_hora: lista(o.por_hora, (x) => ({ hora: n(x.hora), cliques: n(x.cliques) })),
  };
}

/** Data de calendário (AAAA-MM-DD) de hoje em Mossoró. */
export function hojeEmMossoro(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Uma entrada por dia do período, na ordem, com zero nos dias sem clique. */
export function cliquesPorDiaCompleto(r: ResumoCliques, hoje = hojeEmMossoro()): { dia: string; cliques: number }[] {
  const mapa = new Map(r.por_dia.map((x) => [x.dia, x.cliques]));
  return Array.from({ length: r.dias }, (_, i) => {
    const dia = somarDias(hoje, i - (r.dias - 1));
    return { dia, cliques: mapa.get(dia) ?? 0 };
  });
}

/** Segunda a domingo, com zero onde não houve clique. */
export function porDiaDaSemana(r: ResumoCliques): { rotulo: string; nome: string; cliques: number }[] {
  const mapa = new Map(r.por_dia_semana.map((x) => [x.dia, x.cliques]));
  return [1, 2, 3, 4, 5, 6, 0].map((d) => ({ rotulo: CURTOS_DIA[d], nome: NOMES_DIA[d], cliques: mapa.get(d) ?? 0 }));
}

/** 24 horas, de 0h a 23h. */
export function porHora(r: ResumoCliques): { hora: number; cliques: number }[] {
  const mapa = new Map(r.por_hora.map((x) => [x.hora, x.cliques]));
  return Array.from({ length: 24 }, (_, h) => ({ hora: h, cliques: mapa.get(h) ?? 0 }));
}

/** Variação em relação ao período anterior. Sem base de comparação (anterior = 0), devolve null. */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

export function percentual(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

/** Item de maior valor. Em empate, o primeiro. Sem nenhum clique, devolve null. */
export function lider<T extends { cliques: number }>(itens: T[]): T | null {
  let melhor: T | null = null;
  for (const i of itens) if (i.cliques > 0 && (!melhor || i.cliques > melhor.cliques)) melhor = i;
  return melhor;
}

/** Faixa de 3 horas com mais cliques, ex.: "19h às 21h". Sem cliques, null. */
export function janelaDePico(horas: { hora: number; cliques: number }[]): { rotulo: string; cliques: number } | null {
  let melhor = -1;
  let inicio = 0;
  for (let h = 0; h < 24; h++) {
    const soma = horas[h].cliques + horas[(h + 1) % 24].cliques + horas[(h + 2) % 24].cliques;
    if (soma > melhor) {
      melhor = soma;
      inicio = h;
    }
  }
  if (melhor <= 0) return null;
  return { rotulo: `${inicio}h às ${(inicio + 3) % 24}h`, cliques: melhor };
}
