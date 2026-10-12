import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { como, criarBanco, inserirProduto } from "./banco";

let db: PGlite;
const criar = (nome: string, whats: string, desc = "Mochila rosa de rodinha", ref: string | null = null) =>
  como<{ id: string }>(db, "anon", "select public.criar_pedido($1, $2, $3, $4) as id", [nome, whats, desc, ref]);

beforeAll(async () => {
  db = await criarBanco();
});

describe("pedidos de visitantes", () => {
  it("visitante cria pedido pela função e o número é guardado com 55", async () => {
    await criar("  Ana   Maria ", "(84) 98777-0001");
    const rows = await como<{ nome: string; whatsapp: string; status: string }>(db, "admin", "select nome, whatsapp, status from public.pedidos");
    expect(rows).toEqual([{ nome: "Ana Maria", whatsapp: "5584987770001", status: "novo" }]);
  });

  it("visitante não lê, não altera e não grava direto na tabela", async () => {
    await expect(como(db, "anon", "select * from public.pedidos")).rejects.toThrow(/permission denied/);
    await expect(como(db, "anon", "update public.pedidos set status = 'arquivado'")).rejects.toThrow(/permission denied/);
    await expect(
      como(db, "anon", "insert into public.pedidos (nome, whatsapp, descricao) values ('x y', '5584987770009', 'abc')"),
    ).rejects.toThrow(/permission denied/);
  });

  it("usuário logado que não é administrador não vê pedidos", async () => {
    const rows = await como(db, "comum", "select * from public.pedidos");
    expect(rows).toHaveLength(0);
  });

  it("recusa dados inválidos", async () => {
    await expect(criar("A", "84987770002")).rejects.toThrow(/Nome/);
    await expect(criar("Bia", "12345")).rejects.toThrow(/WhatsApp/);
    await expect(criar("Bia", "84987770002", "x")).rejects.toThrow(/Descrição/);
    await expect(criar("Bia", "84987770002", "Panela", "http://exemplo.com")).rejects.toThrow(/referência/);
  });

  it("limita 3 pedidos por número em 24 horas", async () => {
    for (let i = 0; i < 3; i++) await criar("Caio", "5511912340000", `Pedido ${i}`);
    await expect(criar("Caio", "11912340000", "Quarto pedido")).rejects.toThrow(/Limite/);
  });

  it("apaga pedidos com mais de 90 dias", async () => {
    await db.exec(`insert into public.pedidos (nome, whatsapp, descricao, criado_em) values ('Velho', '5584987770003', 'antigo', now() - interval '91 days')`);
    await criar("Duda", "84987770004");
    const rows = await como<{ nome: string }>(db, "admin", "select nome from public.pedidos where nome = 'Velho'");
    expect(rows).toHaveLength(0);
  });

  it("administrador marca como respondido e o produto pode ser excluído sem perder o pedido", async () => {
    const produto = await inserirProduto(db);
    const [p] = await como<{ id: string }>(db, "admin", "select id from public.pedidos limit 1");
    await como(db, "admin", "update public.pedidos set status = 'respondido', produto_id = $1, respondido_em = now() where id = $2", [produto, p.id]);
    await como(db, "admin", "delete from public.produtos where id = $1", [produto]);
    const [r] = await como<{ status: string; produto_id: string | null }>(db, "admin", "select status, produto_id from public.pedidos where id = $1", [p.id]);
    expect(r).toEqual({ status: "respondido", produto_id: null });
  });
});

describe("vídeo do produto", () => {
  it("aceita https e importação grava o vídeo", async () => {
    await como(db, "admin", "select public.importar_produtos($1::jsonb)", [
      JSON.stringify([{ nome: "Com vídeo", slug: "com-video", preco_atual: 10, link_afiliado: "https://s.shopee.com.br/v1", video_url: "https://youtu.be/abcdefghijk", status: "publicado" }]),
    ]);
    const [r] = await como<{ video_url: string }>(db, "anon", "select video_url from public.produtos where slug = 'com-video'");
    expect(r.video_url).toBe("https://youtu.be/abcdefghijk");
    await expect(como(db, "admin", "update public.produtos set video_url = 'http://x.com/a.mp4' where slug = 'com-video'")).rejects.toThrow(/check/);
  });
});
