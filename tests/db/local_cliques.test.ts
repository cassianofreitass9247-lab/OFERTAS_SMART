import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { como, criarBanco, inserirProduto } from "./banco";

let db: PGlite;
let produto: string;

type Locais = {
  total: number;
  com_local: number;
  por_estado: { pais: string; estado: string | null; cliques: number }[];
  por_cidade: { pais: string; estado: string | null; cidade: string; cliques: number }[];
};
const clicar = (pais: string | null, estado: string | null, cidade: string | null) =>
  como(db, "anon", "select public.registrar_clique($1, 'site', null, $2, $3, $4)", [produto, pais, estado, cidade]);
const locais = async (papel: "admin" | "comum" | "anon" = "admin") =>
  (await como<{ r: Locais }>(db, papel, "select public.cliques_locais(30) as r"))[0].r;
const ultimo = async () =>
  (await db.query<{ pais: string | null; estado: string | null; cidade: string | null }>("select pais, estado, cidade from public.cliques order by id desc limit 1")).rows[0];

beforeAll(async () => {
  db = await criarBanco();
  produto = await inserirProduto(db);
});

describe("registrar_clique com local", () => {
  it("continua funcionando sem local (chamada antiga) e guarda tudo nulo", async () => {
    const [r] = await como<{ l: string | null }>(db, "anon", "select public.registrar_clique($1) as l", [produto]);
    expect(r.l).toMatch(/^https:/);
    expect(await ultimo()).toEqual({ pais: null, estado: null, cidade: null });
  });

  it("guarda país, estado e cidade normalizados", async () => {
    await clicar("br", " rn ", "  Mossoró  ");
    expect(await ultimo()).toEqual({ pais: "BR", estado: "RN", cidade: "Mossoró" });
  });

  it("país fora do formato descarta o local inteiro", async () => {
    await clicar("Brasil", "RN", "Natal");
    expect(await ultimo()).toEqual({ pais: null, estado: null, cidade: null });
  });

  it("estado fora do formato vira nulo, mas mantém país e cidade", async () => {
    await clicar("BR", "Rio Grande do Norte", "Natal");
    expect(await ultimo()).toEqual({ pais: "BR", estado: null, cidade: "Natal" });
  });

  it("limita a cidade a 80 caracteres e remove caracteres de controle", async () => {
    await clicar("BR", "RN", "A".repeat(200));
    expect((await ultimo()).cidade).toHaveLength(80);
    await clicar("BR", "RN", "Na\ntal");
    expect((await ultimo()).cidade).toBe("Natal");
  });
});

describe("cliques_locais", () => {
  it("agrupa por estado e cidade e informa quantos têm local", async () => {
    await db.exec("delete from public.cliques");
    await clicar("BR", "RN", "Mossoró");
    await clicar("BR", "RN", "Mossoró");
    await clicar("BR", "RN", "Natal");
    await clicar("BR", "CE", "Fortaleza");
    await clicar("US", "CA", null);
    await clicar(null, null, null);
    const r = await locais();
    expect(r.total).toBe(6);
    expect(r.com_local).toBe(5);
    expect(r.por_estado[0]).toEqual({ pais: "BR", estado: "RN", cliques: 3 });
    expect(r.por_estado.map((e) => `${e.pais}/${e.estado}`)).toEqual(["BR/RN", "BR/CE", "US/CA"]);
    expect(r.por_cidade[0]).toEqual({ pais: "BR", estado: "RN", cidade: "Mossoró", cliques: 2 });
    expect(r.por_cidade.some((c) => c.cidade === "Fortaleza")).toBe(true);
  });

  it("quem não é administrador recebe zeros e o visitante não executa", async () => {
    expect((await locais("comum")).total).toBe(0);
    await expect(locais("anon")).rejects.toThrow();
  });
});
