import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { como, criarBanco } from "./banco";

let db: PGlite;
let pedidoId: string;
const CHAVE = "chave-da-automacao-de-teste";
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

beforeAll(async () => {
  db = await criarBanco();
  await como(db, "admin", "select public.sincronizar_chave_automacao($1)", [sha(CHAVE)]);
  const [{ id }] = await como<{ id: string }>(db, "anon", "select public.criar_pedido('Ana Souza', '84987770001', 'Mochila rosa', null, true) as id");
  pedidoId = id;
});

const ligado = async (papel: "anon" | "admin" = "anon") => (await como<{ r: boolean }>(db, papel, "select public.pedidos_auto_ligado() as r"))[0].r;
const disponivel = async () => (await como<{ r: boolean }>(db, "anon", "select public.pedidos_auto_disponivel() as r"))[0].r;

describe("busca automática dos pedidos (migração 0012)", () => {
  it("nasce desligada: ninguém busca sozinho até a administradora ligar", async () => {
    expect(await ligado()).toBe(false);
    expect(await disponivel()).toBe(false);
  });

  it("só a administradora liga e desliga", async () => {
    await expect(como(db, "anon", "select public.definir_pedidos_auto(true)")).rejects.toThrow(/permission denied/);
    await expect(como(db, "comum", "select public.definir_pedidos_auto(true)")).rejects.toThrow(/Acesso negado/);
    await expect(como(db, "admin", "select public.definir_pedidos_auto(null)")).rejects.toThrow(/inválido/);
    expect(await ligado()).toBe(false);
    await como(db, "admin", "select public.definir_pedidos_auto(true)");
    expect(await ligado()).toBe(true);
    expect(await disponivel()).toBe(true);
  });

  it("teto de 30 buscas por hora: passado dele, o pedido segue sem busca automática", async () => {
    await db.exec(`update public.pedidos set buscado_em = now()`);
    await db.exec(`
      insert into public.pedidos (nome, whatsapp, descricao, buscado_em)
      select 'Fulano', '5584987770' || lpad(g::text, 3, '0'), 'Produto ' || g, now() from generate_series(1, 29) g`);
    expect(await disponivel()).toBe(false); // 30 buscas na última hora
    await db.exec(`delete from public.pedidos where nome = 'Fulano' and descricao = 'Produto 1'`);
    expect(await disponivel()).toBe(true); // 29
    await db.exec(`update public.pedidos set buscado_em = now() - interval '2 hours'`);
    expect(await disponivel()).toBe(true);
  });

  it("desligar vale na hora", async () => {
    await como(db, "admin", "select public.definir_pedidos_auto(false)");
    expect(await disponivel()).toBe(false);
  });

  it("pedido_token: só com a chave certa, só de pedido recente", async () => {
    await expect(como(db, "anon", "select public.pedido_token($1, $2)", ["errada", pedidoId])).rejects.toThrow(/Acesso negado/);
    await expect(como(db, "anon", "select public.pedido_token(null, $1)", [pedidoId])).rejects.toThrow(/Acesso negado/);
    const [a] = await como<{ t: string }>(db, "anon", "select public.pedido_token($1, $2) as t", [CHAVE, pedidoId]);
    expect(a.t).toMatch(/^[0-9a-f]{32}$/);
    const [b] = await como<{ t: string | null }>(db, "anon", "select public.pedido_token($1, '00000000-0000-0000-0000-000000000000') as t", [CHAVE]);
    expect(b.t).toBeNull();
    await db.exec(`update public.pedidos set criado_em = now() - interval '2 hours' where id = '${pedidoId}'`);
    const [c] = await como<{ t: string | null }>(db, "anon", "select public.pedido_token($1, $2) as t", [CHAVE, pedidoId]);
    expect(c.t).toBeNull();
  });
});
