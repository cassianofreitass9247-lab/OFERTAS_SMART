import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { como, criarBanco, inserirProduto } from "./banco";

let db: PGlite;
beforeAll(async () => {
  db = await criarBanco();
});

const novoLote = (papel: "admin" | "comum" | "anon") =>
  como<{ id: string }>(db, papel, "insert into public.lotes_importacao (publicado_direto, total) values (true, 2) returning id");

describe("lotes de importação (migração 0005)", () => {
  it("só a administradora registra e lê lotes", async () => {
    await expect(novoLote("anon")).rejects.toThrow(/permission denied/);
    await expect(novoLote("comum")).rejects.toThrow(/row-level security/);
    const [{ id }] = await novoLote("admin");
    expect(await como(db, "admin", "select id from public.lotes_importacao where id = $1", [id])).toHaveLength(1);
    expect(await como(db, "comum", "select id from public.lotes_importacao")).toHaveLength(0);
    await expect(como(db, "anon", "select id from public.lotes_importacao")).rejects.toThrow(/permission denied/);
  });

  it("não aceita total negativo", async () => {
    await expect(como(db, "admin", "insert into public.lotes_importacao (total) values (-1)")).rejects.toThrow(/check/);
  });

  it("produtos guardam o lote e dá para desfazer: despublica publicados e apaga rascunhos", async () => {
    const [{ id }] = await novoLote("admin");
    const a = await inserirProduto(db, { lote_id: id, status_publicacao: "publicado" });
    const b = await inserirProduto(db, { lote_id: id, status_publicacao: "rascunho" });
    const fora = await inserirProduto(db, { status_publicacao: "publicado" });

    const desp = await como(db, "admin", "update public.produtos set status_publicacao = 'despublicado' where lote_id = $1 and status_publicacao = 'publicado' returning id", [id]);
    const apag = await como(db, "admin", "delete from public.produtos where lote_id = $1 and status_publicacao = 'rascunho' returning id", [id]);
    expect(desp).toHaveLength(1);
    expect(apag).toHaveLength(1);
    const restantes = await como<{ id: string; status_publicacao: string }>(db, "admin", "select id, status_publicacao from public.produtos where id in ($1,$2,$3) order by id", [a, b, fora].sort());
    expect(restantes.find((r) => r.id === a)?.status_publicacao).toBe("despublicado");
    expect(restantes.find((r) => r.id === b)).toBeUndefined();
    expect(restantes.find((r) => r.id === fora)?.status_publicacao).toBe("publicado");
  });

  it("produto publicado de um lote aparece para visitantes; o lote_id não vaza no site público", async () => {
    const [{ id }] = await novoLote("admin");
    const p = await inserirProduto(db, { lote_id: id });
    const vis = await como(db, "anon", "select id from public.produtos where id = $1", [p]);
    expect(vis).toHaveLength(1);
  });
});
