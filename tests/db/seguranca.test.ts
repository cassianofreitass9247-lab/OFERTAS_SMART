import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { como, criarBanco, inserirProduto } from "./banco";

let db: PGlite;
let publicado: string;
let rascunho: string;

beforeAll(async () => {
  db = await criarBanco();
  publicado = await inserirProduto(db, { nome: "Publicado" });
  rascunho = await inserirProduto(db, { nome: "Rascunho", status_publicacao: "rascunho" });
});

describe("políticas de acesso (RLS)", () => {
  it("visitante vê somente produtos publicados", async () => {
    const rows = await como<{ nome: string }>(db, "anon", "select nome from public.produtos");
    expect(rows.map((r) => r.nome)).toEqual(["Publicado"]);
  });

  it("administrador vê todos os produtos", async () => {
    const rows = await como(db, "admin", "select id from public.produtos");
    expect(rows).toHaveLength(2);
  });

  it("visitante não consegue inserir, alterar nem excluir produtos", async () => {
    await expect(
      como(db, "anon", "insert into public.produtos (nome, slug, preco_atual, link_afiliado) values ('x y z','x',1,'https://s.shopee.com.br/x')"),
    ).rejects.toThrow(/permission denied/);
    await expect(como(db, "anon", "update public.produtos set nome = 'invadido'")).rejects.toThrow(/permission denied/);
    await expect(como(db, "anon", "delete from public.produtos")).rejects.toThrow(/permission denied/);
  });

  it("usuário logado que não é administrador não altera nada", async () => {
    await expect(
      como(db, "comum", "insert into public.produtos (nome, slug, preco_atual, link_afiliado) values ('x y z','x',1,'https://s.shopee.com.br/x')"),
    ).rejects.toThrow(/row-level security/);
    await como(db, "comum", "update public.produtos set nome = 'invadido'");
    await como(db, "comum", "delete from public.produtos");
    const rows = await como<{ nome: string }>(db, "admin", "select nome from public.produtos order by nome");
    expect(rows.map((r) => r.nome)).toEqual(["Publicado", "Rascunho"]);
  });

  it("usuário comum não vê rascunhos nem consegue se tornar administrador", async () => {
    const rows = await como(db, "comum", "select id from public.produtos");
    expect(rows).toHaveLength(1);
    await expect(
      como(db, "comum", "insert into public.administradores (user_id) values ('22222222-2222-2222-2222-222222222222')"),
    ).rejects.toThrow(/permission denied/);
  });

  it("cliques, alterações e importações são invisíveis para o público", async () => {
    await como(db, "anon", "select public.registrar_clique($1)", [publicado]);
    await expect(como(db, "anon", "select * from public.cliques")).rejects.toThrow(/permission denied/);
    expect(await como(db, "comum", "select * from public.cliques")).toHaveLength(0);
    expect(await como(db, "admin", "select * from public.cliques")).toHaveLength(1);
    await expect(como(db, "anon", "insert into public.cliques (produto_id) values ($1)", [publicado])).rejects.toThrow(
      /permission denied/,
    );
  });

  it("histórico de preços só aparece para produtos visíveis", async () => {
    const anon = await como<{ produto_id: string }>(db, "anon", "select produto_id from public.historico_precos");
    expect(anon.map((r) => r.produto_id)).toEqual([publicado]);
    expect(await como(db, "admin", "select 1 from public.historico_precos")).toHaveLength(2);
  });

  it("funções administrativas recusam quem não é administrador", async () => {
    await expect(como(db, "anon", "select public.carregar_dados_demo()")).rejects.toThrow(/permission denied/);
    await expect(como(db, "comum", "select public.carregar_dados_demo()")).rejects.toThrow(/Acesso negado/);
    await expect(como(db, "comum", "select public.remover_dados_demo()")).rejects.toThrow(/Acesso negado/);
    await expect(como(db, "comum", "select public.importar_produtos('[]'::jsonb)")).rejects.toThrow(/Acesso negado/);
  });

  it("clique em rascunho não revela o link", async () => {
    const rows = await como<{ link: string | null }>(db, "anon", "select public.registrar_clique($1) as link", [rascunho]);
    expect(rows[0].link).toBeNull();
  });
});
