import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { como, criarBanco } from "./banco";

let db: PGlite;
let pedidoId: string;
let token: string;
const CHAVE = "chave-da-automacao-de-teste";
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

const opcao = (n: number, extra: Record<string, unknown> = {}) => ({
  rotulo: `Opção ${n}`,
  nome: `Mochila infantil modelo ${n}`,
  imagem_url: "https://down-br.img.susercontent.com/file/x" + n,
  preco: 39.9 + n,
  nota: 4.8,
  vendas: 1200,
  loja: "Loja Exemplo",
  link_afiliado: `https://s.shopee.com.br/OPC${n}`,
  id_externo: `123.${4000 + n}`,
  ...extra,
});
const gravar = (opcoes: unknown[], chave: string | null = CHAVE, pedido = pedidoId, papel: "anon" | "admin" | "comum" = "anon") =>
  como<{ n: number }>(db, papel, "select public.pedido_gravar_opcoes($1, $2, $3, $4, $5::jsonb) as n", [chave, pedido, "mochila rosa", "ok", JSON.stringify(opcoes)]);

beforeAll(async () => {
  db = await criarBanco();
  await como(db, "admin", "select public.sincronizar_chave_automacao($1)", [sha(CHAVE)]);
  const [{ id }] = await como<{ id: string }>(db, "anon", "select public.criar_pedido('Ana Maria Souza', '84987770001', 'Mochila rosa de rodinha', null, true) as id");
  pedidoId = id;
  const [p] = await como<{ token: string }>(db, "admin", "select token from public.pedidos where id = $1", [pedidoId]);
  token = p.token;
});

describe("opções de pedido (migração 0011)", () => {
  it("todo pedido nasce com código secreto de 32 caracteres, único", async () => {
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    await como(db, "anon", "select public.criar_pedido('Beto', '84987770002', 'Panela', null, true)");
    const rows = await como<{ t: string }>(db, "admin", "select token as t from public.pedidos");
    expect(new Set(rows.map((r) => r.t)).size).toBe(rows.length);
  });

  it("sem a chave certa, ninguém grava", async () => {
    await expect(gravar([opcao(1)], "errada")).rejects.toThrow(/Acesso negado/);
    await expect(gravar([opcao(1)], null)).rejects.toThrow(/Acesso negado/);
    await expect(gravar([opcao(1)], CHAVE, pedidoId, "comum")).resolves.toBeTruthy(); // chave certa vale para quem a tiver (só o servidor a tem)
  });

  it("grava e substitui as opções, registrando o termo e o resultado no pedido", async () => {
    await gravar([opcao(1), opcao(2), opcao(3)]);
    const [a] = await como<{ n: number }>(db, "admin", "select count(*)::int as n from public.pedido_opcoes where pedido_id = $1", [pedidoId]);
    expect(a.n).toBe(3);
    await gravar([opcao(4), opcao(5)]);
    const rows = await como<{ posicao: number; rotulo: string }>(db, "admin", "select posicao, rotulo from public.pedido_opcoes where pedido_id = $1 order by posicao", [pedidoId]);
    expect(rows).toEqual([{ posicao: 1, rotulo: "Opção 4" }, { posicao: 2, rotulo: "Opção 5" }]);
    const [p] = await como<{ busca_termo: string; busca_resultado: string; buscado_em: string | null }>(db, "admin", "select busca_termo, busca_resultado, buscado_em from public.pedidos where id = $1", [pedidoId]);
    expect(p.busca_termo).toBe("mochila rosa");
    expect(p.busca_resultado).toBe("ok");
    expect(p.buscado_em).not.toBeNull();
  });

  it("recusa mais de 5 opções, pedido inexistente e link que não é da Shopee", async () => {
    await expect(gravar([1, 2, 3, 4, 5, 6].map((n) => opcao(n)))).rejects.toThrow(/inválidas/);
    await expect(gravar([opcao(1)], CHAVE, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(/não encontrado/);
    await expect(gravar([opcao(1, { link_afiliado: "https://evil.com/x" })])).rejects.toThrow(/check/);
    await expect(gravar([opcao(1, { link_afiliado: "https://shopee.com.br.evil.com/x" })])).rejects.toThrow(/check/);
    await expect(gravar([opcao(1, { link_afiliado: "http://s.shopee.com.br/x" })])).rejects.toThrow(/check/);
    await expect(gravar([opcao(1, { id_externo: "abc" })])).rejects.toThrow(/check/);
    // a gravação falha por inteiro: as opções boas anteriores continuam
    const [n] = await como<{ n: number }>(db, "admin", "select count(*)::int as n from public.pedido_opcoes where pedido_id = $1", [pedidoId]);
    expect(n.n).toBe(2);
  });

  it("a tabela não é legível nem gravável pelo público; admin lê", async () => {
    await expect(como(db, "anon", "select * from public.pedido_opcoes")).rejects.toThrow(/permission denied/);
    await expect(como(db, "anon", "insert into public.pedido_opcoes (pedido_id, posicao, rotulo, nome, link_afiliado) values ($1, 1, 'x y', 'x y', 'https://s.shopee.com.br/a')", [pedidoId])).rejects.toThrow(/permission denied/);
    await expect(como(db, "comum", "insert into public.pedido_opcoes (pedido_id, posicao, rotulo, nome, link_afiliado) values ($1, 3, 'x y', 'x y', 'https://s.shopee.com.br/a')", [pedidoId])).rejects.toThrow(/permission denied/);
    expect(await como(db, "comum", "select * from public.pedido_opcoes")).toHaveLength(0);
    expect(await como(db, "admin", "select * from public.pedido_opcoes")).toHaveLength(2);
  });

  it("página pública: só com o código certo, sem WhatsApp, sobrenome nem links", async () => {
    const [r] = await como<{ r: { nome: string; descricao: string; opcoes: Record<string, unknown>[] } | null }>(db, "anon", "select public.pedido_publico($1) as r", [token]);
    expect(r.r?.nome).toBe("Ana");
    expect(r.r?.opcoes).toHaveLength(2);
    const texto = JSON.stringify(r.r);
    expect(texto).not.toMatch(/5584987770001|Souza|shopee\.com\.br|whatsapp/i);
    for (const ruim of ["nao-e-token", "0".repeat(32), "", "' or 1=1 --"]) {
      const [x] = await como<{ r: unknown }>(db, "anon", "select public.pedido_publico($1) as r", [ruim]);
      expect(x.r).toBeNull();
    }
  });

  it("clique na opção conta e devolve o link; opção inexistente devolve nulo", async () => {
    const [o] = await como<{ id: string }>(db, "admin", "select id from public.pedido_opcoes where pedido_id = $1 and posicao = 1", [pedidoId]);
    const [a] = await como<{ l: string | null }>(db, "anon", "select public.registrar_clique_opcao($1) as l", [o.id]);
    expect(a.l).toBe("https://s.shopee.com.br/OPC4");
    await como(db, "anon", "select public.registrar_clique_opcao($1)", [o.id]);
    const [c] = await como<{ cliques: number }>(db, "admin", "select cliques from public.pedido_opcoes where id = $1", [o.id]);
    expect(c.cliques).toBe(2);
    const [b] = await como<{ l: string | null }>(db, "anon", "select public.registrar_clique_opcao('00000000-0000-0000-0000-000000000000') as l");
    expect(b.l).toBeNull();
  });

  it("excluir o pedido apaga as opções (dados somem juntos)", async () => {
    await como(db, "admin", "delete from public.pedidos where id = $1", [pedidoId]);
    expect(await como(db, "admin", "select 1 from public.pedido_opcoes")).toHaveLength(0);
  });
});
