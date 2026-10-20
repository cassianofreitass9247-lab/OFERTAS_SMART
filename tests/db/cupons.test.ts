import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { como, criarBanco } from "./banco";

let db: PGlite;

const novo = (titulo: string, extra: Record<string, unknown> = {}) => {
  const base: Record<string, unknown> = { titulo, codigo: "MONI10", tipo: "percentual", valor: 10, ...extra };
  const cols = Object.keys(base);
  return como<{ id: string }>(
    db,
    "admin",
    `insert into public.cupons (${cols.join(",")}, valido_ate) values (${cols.map((_, i) => "$" + (i + 1)).join(",")}, now() + interval '2 days') returning id`,
    Object.values(base),
  );
};

beforeAll(async () => {
  db = await criarBanco();
});

describe("cupons: leitura pública", () => {
  it("visitante vê só cupom ativo e dentro da validade", async () => {
    await novo("Vigente");
    await novo("Desativado", { ativo: false });
    await db.exec(`insert into public.cupons (titulo, codigo, valido_de, valido_ate) values ('Vencido', 'VELHO', now() - interval '3 days', now() - interval '1 day')`);
    await db.exec(`insert into public.cupons (titulo, codigo, valido_de, valido_ate) values ('Futuro', 'LOGO', now() + interval '1 day', now() + interval '3 days')`);

    const anon = await como<{ titulo: string }>(db, "anon", "select titulo from public.cupons");
    expect(anon.map((r) => r.titulo)).toEqual(["Vigente"]);
    const comum = await como(db, "comum", "select 1 from public.cupons");
    expect(comum).toHaveLength(1);
    const admin = await como(db, "admin", "select 1 from public.cupons");
    expect(admin).toHaveLength(4);
  });
});

describe("cupons: escrita", () => {
  it("visitante e usuário comum não gravam", async () => {
    const sql = "insert into public.cupons (titulo, codigo, valido_ate) values ('Invasor', 'X1', now() + interval '1 day')";
    await expect(como(db, "anon", sql)).rejects.toThrow(/permission denied/);
    await expect(como(db, "comum", sql)).rejects.toThrow(/row-level security/);
    await expect(como(db, "anon", "update public.cupons set ativo = false")).rejects.toThrow(/permission denied/);
    await expect(como(db, "anon", "delete from public.cupons")).rejects.toThrow(/permission denied/);
    // usuário comum: update/delete não atingem nenhuma linha
    await como(db, "comum", "update public.cupons set titulo = 'hackeado'");
    await como(db, "comum", "delete from public.cupons");
    const titulos = await como<{ titulo: string }>(db, "admin", "select titulo from public.cupons where titulo = 'hackeado'");
    expect(titulos).toHaveLength(0);
  });

  it("administrador cria, altera e exclui", async () => {
    const [c] = await novo("Para editar");
    await como(db, "admin", "update public.cupons set titulo = 'Editado', destaque = true where id = $1", [c.id]);
    const [lido] = await como<{ titulo: string; destaque: boolean }>(db, "admin", "select titulo, destaque from public.cupons where id = $1", [c.id]);
    expect(lido).toEqual({ titulo: "Editado", destaque: true });
    await como(db, "admin", "delete from public.cupons where id = $1", [c.id]);
    expect(await como(db, "admin", "select 1 from public.cupons where id = $1", [c.id])).toHaveLength(0);
  });

  it("exige código ou link, validade coerente e valores válidos", async () => {
    await expect(novo("Sem nada", { codigo: null })).rejects.toThrow(/check/);
    await expect(novo("Percentual alto", { valor: 150 })).rejects.toThrow(/check/);
    await expect(novo("Sem valor", { valor: null })).rejects.toThrow(/check/);
    await expect(novo("Código ruim", { codigo: "tem espaço" })).rejects.toThrow(/check/);
    await expect(novo("Link http", { codigo: null, link_resgate: "http://shopee.com.br/x" })).rejects.toThrow(/check/);
    await expect(
      como(db, "admin", "insert into public.cupons (titulo, codigo, valido_de, valido_ate) values ('Invertido','AB',now(), now() - interval '1 day')"),
    ).rejects.toThrow(/check/);
    // frete grátis só com link, sem valor
    const [c] = await novo("Frete grátis", { tipo: "frete", valor: null, codigo: null, link_resgate: "https://s.shopee.com.br/abc" });
    expect(c.id).toBeTruthy();
  });

  it("categoria excluída não apaga o cupom", async () => {
    const [cat] = await como<{ id: string }>(db, "admin", "insert into public.categorias (nome, slug) values ('Casa','casa') returning id");
    const [c] = await novo("Da casa", { categoria_id: cat.id });
    await como(db, "admin", "delete from public.categorias where id = $1", [cat.id]);
    const [lido] = await como<{ categoria_id: string | null }>(db, "admin", "select categoria_id from public.cupons where id = $1", [c.id]);
    expect(lido.categoria_id).toBeNull();
  });
});

describe("cupons: contagem de uso", () => {
  it("conta uso de cupom vigente e devolve o link (ou vazio quando só há código)", async () => {
    const [comLink] = await novo("Com link", { codigo: null, link_resgate: "https://s.shopee.com.br/cupom" });
    const [soCodigo] = await novo("Só código", { codigo: "SOCODIGO" });
    const a = await como<{ r: string | null }>(db, "anon", "select public.registrar_uso_cupom($1) as r", [comLink.id]);
    expect(a[0].r).toBe("https://s.shopee.com.br/cupom");
    const b = await como<{ r: string | null }>(db, "anon", "select public.registrar_uso_cupom($1) as r", [soCodigo.id]);
    expect(b[0].r).toBe("");
    const [n] = await como<{ cliques: number }>(db, "admin", "select cliques from public.cupons where id = $1", [comLink.id]);
    expect(n.cliques).toBe(1);
  });

  it("não conta cupom vencido, desativado ou inexistente", async () => {
    const [off] = await novo("Desligado", { ativo: false });
    const [velho] = await como<{ id: string }>(
      db,
      "admin",
      "insert into public.cupons (titulo, codigo, valido_de, valido_ate) values ('Vencido 2','OLD', now() - interval '3 days', now() - interval '1 day') returning id",
    );
    for (const id of [off.id, velho.id, "00000000-0000-0000-0000-000000000000"]) {
      const r = await como<{ r: string | null }>(db, "anon", "select public.registrar_uso_cupom($1) as r", [id]);
      expect(r[0].r).toBeNull();
    }
    const [n] = await como<{ cliques: number }>(db, "admin", "select cliques from public.cupons where id = $1", [off.id]);
    expect(n.cliques).toBe(0);
  });

  it("visitante não consegue alterar o contador direto", async () => {
    await expect(como(db, "anon", "update public.cupons set cliques = 999")).rejects.toThrow(/permission denied/);
  });
});
