import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { como, criarBanco, inserirProduto } from "./banco";

let db: PGlite;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const CHAVE = "chave-do-servidor-de-teste";
let n = 0;
const numero = () => `5584987${String(100000 + ++n).slice(-6)}`;

const pedir = (opcoes: { consentimento?: boolean | null; chave?: string | null } = {}) =>
  como<{ id: string }>(db, "anon", "select public.criar_pedido($1, $2, $3, null, $4, $5) as id", [
    "Ana",
    numero(),
    "Panela de pressão",
    opcoes.consentimento === undefined ? true : opcoes.consentimento,
    opcoes.chave ?? null,
  ]);

beforeAll(async () => {
  db = await criarBanco();
});

describe("pedidos: consentimento e chave do servidor", () => {
  it("recusa pedido sem consentimento, mesmo chamando a função direto", async () => {
    await expect(pedir({ consentimento: false })).rejects.toThrow(/autorização/);
    await expect(pedir({ consentimento: null })).rejects.toThrow(/autorização/);
    await expect(como(db, "anon", "select public.criar_pedido('Ana', '84987770101', 'Panela')")).rejects.toThrow(/autorização/);
  });

  it("grava a data do consentimento", async () => {
    const [{ id }] = await pedir();
    const [r] = await como<{ ok: boolean }>(db, "admin", "select consentimento_em is not null as ok from public.pedidos where id = $1", [id]);
    expect(r.ok).toBe(true);
  });

  it("sem chave registrada, aceita pedido sem chave (comportamento anterior)", async () => {
    await expect(pedir()).resolves.toHaveLength(1);
  });

  it("só a administradora registra a chave, e ninguém lê a configuração", async () => {
    await expect(como(db, "anon", "select public.sincronizar_chave_servidor($1)", [sha(CHAVE)])).rejects.toThrow(/permission denied/);
    await expect(como(db, "comum", "select public.sincronizar_chave_servidor($1)", [sha(CHAVE)])).rejects.toThrow(/Acesso negado/);
    await expect(como(db, "admin", "select public.sincronizar_chave_servidor('nao-e-hash')")).rejects.toThrow(/Hash/);
    const [r] = await como<{ mudou: boolean }>(db, "admin", "select public.sincronizar_chave_servidor($1) as mudou", [sha(CHAVE)]);
    expect(r.mudou).toBe(true);
    const [r2] = await como<{ mudou: boolean }>(db, "admin", "select public.sincronizar_chave_servidor($1) as mudou", [sha(CHAVE)]);
    expect(r2.mudou).toBe(false);
    for (const papel of ["anon", "comum", "admin"] as const) {
      await expect(como(db, papel, "select * from public.config_servidor")).rejects.toThrow(/permission denied/);
    }
  });

  it("com chave registrada, recusa chamada sem chave ou com chave errada", async () => {
    await expect(pedir()).rejects.toThrow(/recusado/);
    await expect(pedir({ chave: "chute" })).rejects.toThrow(/recusado/);
    await expect(pedir({ chave: CHAVE })).resolves.toHaveLength(1);
  });

  it("limpar a chave volta a aceitar pedidos sem chave", async () => {
    await como(db, "admin", "select public.sincronizar_chave_servidor(null)");
    await expect(pedir()).resolves.toHaveLength(1);
  });
});

describe("cliques: teto contra cliques falsos", () => {
  it("conta até 20 cliques por produto por minuto, mas sempre devolve o link", async () => {
    const id = await inserirProduto(db, { link_afiliado: "https://s.shopee.com.br/teto" });
    for (let i = 0; i < 25; i++) {
      const [r] = await como<{ link: string }>(db, "anon", "select public.registrar_clique($1) as link", [id]);
      expect(r.link).toBe("https://s.shopee.com.br/teto");
    }
    const [c] = await como<{ n: number }>(db, "admin", "select count(*)::int as n from public.cliques where produto_id = $1", [id]);
    expect(c.n).toBe(20);
  });

  it("cliques antigos não contam para o teto do minuto", async () => {
    const id = await inserirProduto(db);
    await db.exec(`insert into public.cliques (produto_id, criado_em) select '${id}', now() - interval '2 minutes' from generate_series(1, 30)`);
    await como(db, "anon", "select public.registrar_clique($1)", [id]);
    const [c] = await como<{ n: number }>(db, "admin", "select count(*)::int as n from public.cliques where produto_id = $1", [id]);
    expect(c.n).toBe(31);
  });

  it("para de contar acima de 3.000 cliques por hora no site todo", async () => {
    const outro = await inserirProduto(db);
    await db.exec(`insert into public.cliques (produto_id) select '${outro}' from generate_series(1, 3000)`);
    const id = await inserirProduto(db);
    await como(db, "anon", "select public.registrar_clique($1)", [id]);
    const [c] = await como<{ n: number }>(db, "admin", "select count(*)::int as n from public.cliques where produto_id = $1", [id]);
    expect(c.n).toBe(0);
  });
});
