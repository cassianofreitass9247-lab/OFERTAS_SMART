import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { DepsOpcoes } from "@/lib/pedido-opcoes";
import { gerarOpcoesDoPedido, MSG_MIGRACAO_OPCOES } from "@/lib/pedido-servidor";
import type { Oferta } from "@/lib/shopee";
import { ErroShopee } from "@/lib/shopee";

const oferta = (n: number): Oferta => ({
  itemId: String(500 + n), shopId: "9", nome: `Panela antiaderente ${n}`, imagemUrl: null, precoMin: 40 + n, precoMax: null, comissao: 5,
  vendas: 100 * n, nota: 4.8, desconto: null, loja: "Loja", linkProduto: `https://shopee.com.br/product/9/${500 + n}`, linkAfiliado: `https://s.shopee.com.br/O${n}`,
});
const deps = (extra: Partial<DepsOpcoes> = {}): DepsOpcoes => ({
  buscarOfertas: vi.fn(async () => [oferta(1), oferta(2), oferta(3)]),
  ofertaPorLink: vi.fn(async () => null),
  gerarLink: vi.fn(async (_u: string, ids: string[]) => `https://s.shopee.com.br/L${ids[2]}`),
  ...extra,
});
const pedido = { id: "11111111-2222-3333-4444-555555555555", descricao: "Quero uma panela antiaderente", referencia_url: null };
const cliente = (resposta: { error: { code?: string; message: string } | null }) => {
  const rpc = vi.fn(async () => ({ data: 3, ...resposta }));
  return { sb: { rpc } as unknown as SupabaseClient<Database>, rpc };
};

describe("gerarOpcoesDoPedido", () => {
  it("grava as opções pela função com chave e devolve o resumo", async () => {
    const { sb, rpc } = cliente({ error: null });
    const r = await gerarOpcoesDoPedido(sb, pedido, null, deps(), "chave-x");
    expect(r).toMatchObject({ ok: true, quantidade: 3 });
    const [nome, args] = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(nome).toBe("pedido_gravar_opcoes");
    expect(args).toMatchObject({ p_chave: "chave-x", p_pedido: pedido.id, p_termo: "panela antiaderente" });
    expect((args.p_opcoes as unknown[]).length).toBe(3);
  });

  it("sem chave da automação, não faz nada", async () => {
    const antes = process.env.SHOPEE_SECRET;
    delete process.env.SHOPEE_SECRET;
    const { sb, rpc } = cliente({ error: null });
    const r = await gerarOpcoesDoPedido(sb, pedido, null, deps());
    process.env.SHOPEE_SECRET = antes;
    if (antes === undefined) delete process.env.SHOPEE_SECRET;
    expect(r).toMatchObject({ ok: false, erro: expect.stringContaining("SHOPEE_SECRET") });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("erro da Shopee vira mensagem e nada é gravado", async () => {
    const { sb, rpc } = cliente({ error: null });
    const r = await gerarOpcoesDoPedido(sb, pedido, null, deps({ buscarOfertas: vi.fn(async () => { throw new ErroShopee(10030, "Limite de consultas da Shopee atingido."); }) }), "k");
    expect(r).toEqual({ ok: false, erro: "Limite de consultas da Shopee atingido." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("traduz os erros do banco: migração ausente e chave não registrada", async () => {
    expect(await gerarOpcoesDoPedido(cliente({ error: { code: "42883", message: "x" } }).sb, pedido, null, deps(), "k")).toEqual({ ok: false, erro: MSG_MIGRACAO_OPCOES });
    expect(await gerarOpcoesDoPedido(cliente({ error: { code: "42501", message: "Acesso negado" } }).sb, pedido, null, deps(), "k")).toMatchObject({ ok: false, erro: expect.stringContaining("abra qualquer página do painel") });
  });
});
