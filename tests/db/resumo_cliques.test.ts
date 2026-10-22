import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { como, criarBanco, inserirProduto } from "./banco";

let db: PGlite;
let produto: string;

// Insere um clique em um instante exato (UTC).
const clique = (quando: string) => db.query("insert into public.cliques (produto_id, canal, criado_em) values ($1, 'site', $2)", [produto, quando]);
type Saida = { dias: number; total: number; anterior: number; por_dia: { dia: string; cliques: number }[]; por_dia_semana: { dia: number; cliques: number }[]; por_hora: { hora: number; cliques: number }[] };
const soma = (l: { cliques: number }[]) => l.reduce((s, x) => s + x.cliques, 0);
const resumo = async (papel: "admin" | "comum" | "anon", dias = 30) => {
  const [r] = await como<{ r: Saida }>(db, papel, "select public.cliques_resumo($1) as r", [dias]);
  return r.r;
};

beforeAll(async () => {
  db = await criarBanco();
  produto = await inserirProduto(db);
});

describe("cliques_resumo", () => {
  it("sem cliques devolve zeros e listas vazias", async () => {
    const r = await resumo("admin");
    expect(r.total).toBe(0);
    expect(r.anterior).toBe(0);
    expect(r.por_dia).toEqual([]);
  });

  it("conta o dia, o dia da semana e a hora no horário de Mossoró (UTC-3), não em UTC", async () => {
    await db.exec("delete from public.cliques");
    await clique(new Date().toISOString());
    const [esperado] = (
      await db.query<{ dia: string; dow: number; h: number }>(
        "select (now() at time zone 'America/Fortaleza')::date::text as dia, extract(dow from now() at time zone 'America/Fortaleza')::int as dow, extract(hour from now() at time zone 'America/Fortaleza')::int as h",
      )
    ).rows;
    const r = await resumo("admin", 7);
    expect(r.total).toBe(1);
    expect(r.por_dia).toEqual([{ dia: esperado.dia, cliques: 1 }]);
    expect(r.por_dia_semana).toEqual([{ dia: esperado.dow, cliques: 1 }]);
    expect(r.por_hora).toEqual([{ hora: esperado.h, cliques: 1 }]);
  });

  it("agrupa os cliques recentes e compara com o período anterior", async () => {
    await db.exec("delete from public.cliques");
    const agora = Date.now();
    const h = (horas: number) => new Date(agora - horas * 3_600_000).toISOString();
    await clique(h(1));
    await clique(h(2));
    await clique(h(30 * 24 + 5)); // fora de 7 dias, dentro do período anterior de 30
    await clique(h(10 * 24)); // dentro dos 30 dias
    const r7 = await resumo("admin", 7);
    expect(r7.total).toBeGreaterThanOrEqual(1);
    expect(r7.total).toBeLessThanOrEqual(2);
    const r30 = await resumo("admin", 30);
    expect(r30.total).toBe(3);
    expect(soma(r30.por_dia)).toBe(3);
    expect(soma(r30.por_dia_semana)).toBe(3);
    expect(soma(r30.por_hora)).toBe(3);
    expect(r30.anterior).toBe(1);
  });

  it("limita o período entre 1 e 365 dias", async () => {
    expect((await resumo("admin", 0)).dias).toBe(1);
    expect((await resumo("admin", 9999)).dias).toBe(365);
  });

  it("quem não é administrador recebe zeros (os cliques não são visíveis)", async () => {
    expect((await resumo("comum")).total).toBe(0);
  });

  it("visitante anônimo não pode executar a função", async () => {
    await expect(resumo("anon")).rejects.toThrow();
  });
});
