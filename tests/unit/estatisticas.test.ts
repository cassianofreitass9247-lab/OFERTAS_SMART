import { describe, expect, it } from "vitest";
import {
  cliquesPorDiaCompleto,
  hojeEmMossoro,
  janelaDePico,
  lerPeriodo,
  lerResumo,
  lider,
  percentual,
  porDiaDaSemana,
  porHora,
  variacaoPercentual,
} from "@/lib/estatisticas";

describe("lerPeriodo", () => {
  it("aceita 7, 30 e 90; qualquer outra coisa vira 30", () => {
    expect(lerPeriodo("7")).toBe(7);
    expect(lerPeriodo("90")).toBe(90);
    expect(lerPeriodo(["7", "30"])).toBe(7);
    expect(lerPeriodo("15")).toBe(30);
    expect(lerPeriodo("abc")).toBe(30);
    expect(lerPeriodo(undefined)).toBe(30);
  });
});

describe("lerResumo", () => {
  it("dado inesperado vira zeros, sem quebrar", () => {
    const r = lerResumo(null, 30);
    expect(r).toEqual({ dias: 30, total: 0, anterior: 0, por_dia: [], por_dia_semana: [], por_hora: [] });
    expect(lerResumo({ total: "x", por_dia: [1, null, { dia: 5 }] }, 7).por_dia).toEqual([]);
  });
  it("normaliza a data para AAAA-MM-DD", () => {
    expect(lerResumo({ por_dia: [{ dia: "2026-10-21T00:00:00", cliques: 3 }] }, 7).por_dia).toEqual([{ dia: "2026-10-21", cliques: 3 }]);
  });
});

describe("hojeEmMossoro", () => {
  it("usa o fuso de Mossoró (UTC-3)", () => {
    expect(hojeEmMossoro(new Date("2026-10-22T01:30:00Z"))).toBe("2026-10-21");
    expect(hojeEmMossoro(new Date("2026-10-22T03:00:00Z"))).toBe("2026-10-22");
  });
});

describe("cliquesPorDiaCompleto", () => {
  it("devolve um item por dia do período, com zero nos dias sem clique, terminando hoje", () => {
    const r = lerResumo({ dias: 7, por_dia: [{ dia: "2026-10-21", cliques: 4 }, { dia: "2026-10-18", cliques: 2 }] }, 7);
    const dias = cliquesPorDiaCompleto(r, "2026-10-21");
    expect(dias).toHaveLength(7);
    expect(dias[0].dia).toBe("2026-10-15");
    expect(dias[6]).toEqual({ dia: "2026-10-21", cliques: 4 });
    expect(dias.find((d) => d.dia === "2026-10-18")?.cliques).toBe(2);
    expect(dias.reduce((s, d) => s + d.cliques, 0)).toBe(6);
  });
  it("atravessa virada de mês e de ano", () => {
    const dias = cliquesPorDiaCompleto(lerResumo({ dias: 3 }, 3), "2027-01-01");
    expect(dias.map((d) => d.dia)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
  });
});

describe("porDiaDaSemana e porHora", () => {
  it("ordena de segunda a domingo (domingo é 0 no banco)", () => {
    const r = lerResumo({ por_dia_semana: [{ dia: 0, cliques: 9 }, { dia: 1, cliques: 2 }] }, 30);
    const s = porDiaDaSemana(r);
    expect(s.map((d) => d.rotulo)).toEqual(["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]);
    expect(s[0].cliques).toBe(2);
    expect(s[6]).toEqual({ rotulo: "Dom", nome: "Domingo", cliques: 9 });
  });
  it("completa as 24 horas", () => {
    const h = porHora(lerResumo({ por_hora: [{ hora: 19, cliques: 5 }] }, 30));
    expect(h).toHaveLength(24);
    expect(h[19].cliques).toBe(5);
    expect(h[0].cliques).toBe(0);
  });
});

describe("variacaoPercentual e percentual", () => {
  it("compara com o período anterior; sem base, devolve null", () => {
    expect(variacaoPercentual(118, 100)).toBe(18);
    expect(variacaoPercentual(50, 100)).toBe(-50);
    expect(variacaoPercentual(10, 0)).toBeNull();
  });
  it("percentual com total zero é 0", () => {
    expect(percentual(5, 0)).toBe(0);
    expect(percentual(1, 3)).toBe(33);
  });
});

describe("lider e janelaDePico", () => {
  it("líder ignora zero e, no empate, fica o primeiro", () => {
    expect(lider([{ cliques: 0 }, { cliques: 0 }])).toBeNull();
    expect(lider([{ cliques: 3, n: "a" }, { cliques: 3, n: "b" }])).toMatchObject({ n: "a" });
  });
  it("faixa de 3 horas com mais cliques", () => {
    const horas = porHora(lerResumo({ por_hora: [{ hora: 19, cliques: 9 }, { hora: 20, cliques: 8 }, { hora: 21, cliques: 1 }] }, 30));
    expect(janelaDePico(horas)).toEqual({ rotulo: "19h às 22h", cliques: 18 });
    expect(janelaDePico(porHora(lerResumo({}, 30)))).toBeNull();
  });
  it("a faixa atravessa a meia-noite", () => {
    const horas = porHora(lerResumo({ por_hora: [{ hora: 23, cliques: 5 }, { hora: 0, cliques: 5 }, { hora: 1, cliques: 5 }] }, 30));
    expect(janelaDePico(horas)?.rotulo).toBe("23h às 2h");
  });
});
