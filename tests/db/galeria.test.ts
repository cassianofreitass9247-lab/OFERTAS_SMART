import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { como, criarBanco } from "./banco";

let db: PGlite;
const item = (o: Record<string, unknown> = {}) => ({
  nome: "Mochila", slug: "mochila-g", preco_atual: 10, link_afiliado: "https://s.shopee.com.br/g1", status: "publicado", ...o,
});
const importar = (itens: unknown[]) => como(db, "admin", "select public.importar_produtos($1::jsonb)", [JSON.stringify(itens)]);
const fotos = async () => (await como<{ imagens: string[] }>(db, "admin", "select imagens from public.produtos where slug = 'mochila-g'"))[0].imagens;

beforeAll(async () => {
  db = await criarBanco();
});

describe("galeria de imagens", () => {
  it("produto novo começa sem fotos adicionais", async () => {
    await importar([item()]);
    expect(await fotos()).toEqual([]);
  });

  it("importação guarda as fotos na ordem; coluna vazia depois não apaga a galeria", async () => {
    await importar([item({ imagens: ["https://a.com/1.jpg", "https://a.com/2.jpg"] })]);
    expect(await fotos()).toEqual(["https://a.com/1.jpg", "https://a.com/2.jpg"]);
    await importar([item({ imagens: [] })]);
    expect(await fotos()).toEqual(["https://a.com/1.jpg", "https://a.com/2.jpg"]);
  });

  it("o banco recusa foto sem https e mais de 7 fotos", async () => {
    await expect(importar([item({ imagens: ["http://a.com/1.jpg"] })])).rejects.toThrow();
    const oito = Array.from({ length: 8 }, (_, i) => `https://a.com/${i}.jpg`);
    await expect(importar([item({ imagens: oito })])).rejects.toThrow();
  });

  it("visitante vê as fotos do produto publicado", async () => {
    const r = await como<{ imagens: string[] }>(db, "anon", "select imagens from public.produtos where slug = 'mochila-g'");
    expect(r[0].imagens).toHaveLength(2);
  });
});
