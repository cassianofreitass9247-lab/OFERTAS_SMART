import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { como, criarBanco, inserirProduto } from "./banco";

let db: PGlite;
beforeAll(async () => {
  db = await criarBanco();
});

type Preco = { preco_atual: string; preco_anterior: string | null; preco_anterior_fonte: string | null; desconto_percentual: number | null };
const lerPreco = async (id: string) =>
  (await como<Preco>(db, "admin", "select preco_atual, preco_anterior, preco_anterior_fonte, desconto_percentual from public.produtos where id = $1", [id]))[0];

describe("preço anterior comprovado", () => {
  it("ignora preço anterior digitado no cadastro", async () => {
    const id = await inserirProduto(db, { preco_anterior: 500, preco_anterior_fonte: "historico_proprio", preco_anterior_em: new Date().toISOString() });
    const p = await lerPreco(id);
    expect(p.preco_anterior).toBeNull();
    expect(p.desconto_percentual).toBeNull();
  });

  it("queda de preço registra o preço anterior e calcula o desconto", async () => {
    const id = await inserirProduto(db, { preco_atual: 200 });
    await como(db, "admin", "update public.produtos set preco_atual = 150 where id = $1", [id]);
    const p = await lerPreco(id);
    expect(Number(p.preco_anterior)).toBe(200);
    expect(p.preco_anterior_fonte).toBe("historico_proprio");
    expect(p.desconto_percentual).toBe(25);
  });

  it("não aceita inflar o preço anterior depois", async () => {
    const id = await inserirProduto(db, { preco_atual: 200 });
    await como(db, "admin", "update public.produtos set preco_atual = 150 where id = $1", [id]);
    await como(db, "admin", "update public.produtos set preco_anterior = 999 where id = $1", [id]);
    expect(Number((await lerPreco(id)).preco_anterior)).toBe(200);
  });

  it("aumento de preço apaga o preço anterior", async () => {
    const id = await inserirProduto(db, { preco_atual: 200 });
    await como(db, "admin", "update public.produtos set preco_atual = 150 where id = $1", [id]);
    await como(db, "admin", "update public.produtos set preco_atual = 180 where id = $1", [id]);
    const p = await lerPreco(id);
    expect(p.preco_anterior).toBeNull();
    expect(p.desconto_percentual).toBeNull();
  });

  it("permite remover o preço anterior (correção de erro de digitação)", async () => {
    const id = await inserirProduto(db, { preco_atual: 1000 });
    await como(db, "admin", "update public.produtos set preco_atual = 100 where id = $1", [id]);
    await como(db, "admin", "update public.produtos set preco_anterior = null where id = $1", [id]);
    const p = await lerPreco(id);
    expect(p.preco_anterior).toBeNull();
    expect(p.preco_anterior_fonte).toBeNull();
  });
});

describe("históricos", () => {
  it("guarda cada mudança de preço e de campos", async () => {
    const id = await inserirProduto(db, { preco_atual: 80, nome: "Nome antigo" });
    await como(db, "admin", "update public.produtos set preco_atual = 70, nome = 'Nome novo' where id = $1", [id]);
    await como(db, "admin", "update public.produtos set destaque = true where id = $1", [id]);
    const precos = await como<{ preco: string }>(db, "admin", "select preco from public.historico_precos where produto_id = $1 order by id", [id]);
    expect(precos.map((r) => Number(r.preco))).toEqual([80, 70]);
    const alt = await como<{ campo: string; valor_antigo: string; valor_novo: string; alterado_por: string }>(
      db, "admin", "select campo, valor_antigo, valor_novo, alterado_por from public.historico_alteracoes where produto_id = $1 order by id", [id]);
    expect(alt.map((a) => a.campo).sort()).toEqual(["destaque", "nome", "preco_atual"]);
    expect(alt.find((a) => a.campo === "nome")).toMatchObject({ valor_antigo: "Nome antigo", valor_novo: "Nome novo" });
    expect(alt[0].alterado_por).toBe("11111111-1111-1111-1111-111111111111");
  });
});

describe("duplicados e validações do banco", () => {
  it("recusa dois produtos com o mesmo link de afiliado", async () => {
    await inserirProduto(db, { link_afiliado: "https://s.shopee.com.br/igual" });
    await expect(inserirProduto(db, { link_afiliado: "https://s.shopee.com.br/igual" })).rejects.toThrow(/produtos_link_afiliado_unico/);
  });

  it("recusa link sem https e preço zero", async () => {
    await expect(inserirProduto(db, { link_afiliado: "http://s.shopee.com.br/a" })).rejects.toThrow(/check constraint/);
    await expect(inserirProduto(db, { preco_atual: 0 })).rejects.toThrow(/check constraint/);
  });

  it("produto real não pode ser marcado como fictício", async () => {
    await expect(inserirProduto(db, { ficticio: true })).rejects.toThrow(/produtos_ficticio_somente_demo/);
  });
});

describe("cliques", () => {
  it("registra o clique e devolve o link do produto publicado", async () => {
    const id = await inserirProduto(db, { link_afiliado: "https://s.shopee.com.br/clique" });
    const r = await como<{ link: string }>(db, "anon", "select public.registrar_clique($1, 'telegram', 'semana-1') as link", [id]);
    expect(r[0].link).toBe("https://s.shopee.com.br/clique");
    const c = await como<{ canal: string; campanha: string }>(db, "admin", "select canal, campanha from public.cliques where produto_id = $1", [id]);
    expect(c).toEqual([{ canal: "telegram", campanha: "semana-1" }]);
    const top = await como<{ produto_id: string; cliques: number }>(db, "admin", "select * from public.produtos_mais_clicados(30, 5)");
    expect(top[0]).toMatchObject({ produto_id: id });
    const canais = await como<{ canal: string }>(db, "admin", "select * from public.cliques_por_canal(30)");
    expect(canais[0].canal).toBe("telegram");
  });
});

describe("dados de demonstração", () => {
  it("são sempre fictícios, nunca redirecionam e podem ser removidos", async () => {
    const qtd = await como<{ n: number }>(db, "admin", "select public.carregar_dados_demo() as n");
    expect(qtd[0].n).toBe(6);
    const demo = await como<{ id: string; ficticio: boolean; origem: string; link_afiliado: string }>(
      db, "anon", "select id, ficticio, origem, link_afiliado from public.produtos where slug like 'demo-%'");
    expect(demo).toHaveLength(6);
    expect(demo.every((d) => d.ficticio && d.origem === "demo" && d.link_afiliado.startsWith("https://example.com/"))).toBe(true);
    const link = await como<{ link: string | null }>(db, "anon", "select public.registrar_clique($1) as link", [demo[0].id]);
    expect(link[0].link).toBeNull();
    // carregar duas vezes não duplica
    expect((await como<{ n: number }>(db, "admin", "select public.carregar_dados_demo() as n"))[0].n).toBe(0);
    expect((await como<{ n: number }>(db, "admin", "select public.remover_dados_demo() as n"))[0].n).toBe(6);
    expect(await como(db, "admin", "select 1 from public.produtos where ficticio")).toHaveLength(0);
  });
});

describe("importação", () => {
  const item = (extra: Record<string, unknown> = {}) => ({
    nome: "Liquidificador 900W", slug: "liquidificador-900w-abc123", preco_atual: 129.9,
    link_afiliado: "https://s.shopee.com.br/liq", categoria_nome: "Cozinha Teste", categoria_slug: "cozinha-teste",
    status: "rascunho", ...extra,
  });

  it("insere, cria a categoria e na segunda vez atualiza em vez de duplicar", async () => {
    const r1 = await como<{ r: { inseridos: number; atualizados: number } }>(
      db, "admin", "select public.importar_produtos($1::jsonb, 'teste.csv', 1, '[{\"linha\":3,\"motivo\":\"x\"}]'::jsonb) as r", [JSON.stringify([item()])]);
    expect(r1[0].r).toEqual({ inseridos: 1, atualizados: 0 });

    const r2 = await como<{ r: { inseridos: number; atualizados: number } }>(
      db, "admin", "select public.importar_produtos($1::jsonb) as r", [JSON.stringify([item({ preco_atual: 99.9, slug: "outro-slug" })])]);
    expect(r2[0].r).toEqual({ inseridos: 0, atualizados: 1 });

    const p = await como<{ slug: string; origem: string; status_publicacao: string; preco_atual: string; preco_anterior: string; categoria: string }>(
      db, "admin",
      "select p.slug, p.origem, p.status_publicacao, p.preco_atual, p.preco_anterior, c.nome as categoria from public.produtos p join public.categorias c on c.id = p.categoria_id where p.link_afiliado = 'https://s.shopee.com.br/liq'");
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ slug: "liquidificador-900w-abc123", origem: "csv", status_publicacao: "rascunho", categoria: "Cozinha Teste" });
    expect(Number(p[0].preco_atual)).toBe(99.9);
    expect(Number(p[0].preco_anterior)).toBe(129.9);

    const imp = await como<{ total: number; rejeitados: number }>(db, "admin", "select total, rejeitados from public.importacoes where arquivo_nome = 'teste.csv'");
    expect(imp[0]).toEqual({ total: 2, rejeitados: 1 });
  });

  it("reconhece o mesmo produto pelo id externo mesmo com link novo", async () => {
    await como(db, "admin", "select public.importar_produtos($1::jsonb)", [JSON.stringify([item({ link_afiliado: "https://s.shopee.com.br/a1", id_externo: "999", slug: "s-a1" })])]);
    await como(db, "admin", "select public.importar_produtos($1::jsonb)", [JSON.stringify([item({ link_afiliado: "https://s.shopee.com.br/a2", id_externo: "999", slug: "s-a2" })])]);
    const p = await como<{ link_afiliado: string }>(db, "admin", "select link_afiliado from public.produtos where id_externo = '999'");
    expect(p).toEqual([{ link_afiliado: "https://s.shopee.com.br/a2" }]);
  });

  it("se um item falhar, nada do lote é gravado", async () => {
    const lote = [item({ link_afiliado: "https://s.shopee.com.br/ok1", slug: "ok-1" }), item({ link_afiliado: "https://s.shopee.com.br/ruim", slug: "ruim", preco_atual: -5 })];
    await expect(como(db, "admin", "select public.importar_produtos($1::jsonb)", [JSON.stringify(lote)])).rejects.toThrow(/check constraint/);
    expect(await como(db, "admin", "select 1 from public.produtos where slug = 'ok-1'")).toHaveLength(0);
  });
});
