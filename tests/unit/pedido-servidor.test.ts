import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { DepsOpcoes } from "@/lib/pedido-opcoes";
import { gerarOpcoesDoPedido, MSG_MIGRACAO_OPCOES, opcoesAutomaticasDoPedido } from "@/lib/pedido-servidor";
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

describe("opcoesAutomaticasDoPedido", () => {
  const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
  type Resp = { data: unknown; error: { code?: string; message: string } | null };
  const banco = (resp: Record<string, Resp | (() => never)>) => {
    const rpc = vi.fn(async (nome: string) => {
      const r = resp[nome];
      if (typeof r === "function") return r();
      return r ?? { data: null, error: { message: "função desconhecida" } };
    });
    return { sb: { rpc } as unknown as SupabaseClient<Database>, rpc };
  };
  const tudoOk: Record<string, Resp> = {
    pedidos_auto_disponivel: { data: true, error: null },
    pedido_gravar_opcoes: { data: 3, error: null },
    pedido_token: { data: TOKEN, error: null },
  };
  const chamou = (rpc: ReturnType<typeof vi.fn>, nome: string) => rpc.mock.calls.some((c) => c[0] === nome);

  it("ligado: busca, grava e devolve o código da página com a quantidade", async () => {
    const { sb, rpc } = banco(tudoOk);
    const r = await opcoesAutomaticasDoPedido(sb, pedido, deps(), 5000, "k");
    expect(r).toEqual({ token: TOKEN, quantidade: 3 });
    expect(chamou(rpc, "pedido_gravar_opcoes")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("pedido_token", { p_chave: "k", p_pedido: pedido.id });
  });

  it("desligado ou acima do teto por hora: nem chama a Shopee", async () => {
    const d = deps();
    const { sb, rpc } = banco({ ...tudoOk, pedidos_auto_disponivel: { data: false, error: null } });
    expect(await opcoesAutomaticasDoPedido(sb, pedido, d, 5000, "k")).toBeNull();
    expect(d.buscarOfertas).not.toHaveBeenCalled();
    expect(chamou(rpc, "pedido_gravar_opcoes")).toBe(false);
  });

  it("banco sem a migração 0012: segue sem busca, sem erro", async () => {
    const d = deps();
    const { sb } = banco({ ...tudoOk, pedidos_auto_disponivel: { data: null, error: { code: "PGRST202", message: "não existe" } } });
    expect(await opcoesAutomaticasDoPedido(sb, pedido, d, 5000, "k")).toBeNull();
    expect(d.buscarOfertas).not.toHaveBeenCalled();
  });

  it("Shopee falhou ou não achou nada: nulo, e o código da página não é pedido", async () => {
    const falha = banco(tudoOk);
    const d = deps({ buscarOfertas: vi.fn(async () => { throw new ErroShopee(10030, "Limite"); }) });
    expect(await opcoesAutomaticasDoPedido(falha.sb, pedido, d, 5000, "k")).toBeNull();
    expect(chamou(falha.rpc, "pedido_token")).toBe(false);

    const vazio = banco({ ...tudoOk, pedido_gravar_opcoes: { data: 0, error: null } });
    expect(await opcoesAutomaticasDoPedido(vazio.sb, pedido, deps({ buscarOfertas: vi.fn(async () => []) }), 5000, "k")).toBeNull();
    expect(chamou(vazio.rpc, "pedido_token")).toBe(false);
  });

  it("demora demais: desiste no prazo", async () => {
    const lenta = deps({ buscarOfertas: vi.fn(() => new Promise<Oferta[]>(() => {})) });
    const { sb } = banco(tudoOk);
    const t0 = Date.now();
    expect(await opcoesAutomaticasDoPedido(sb, pedido, lenta, 50, "k")).toBeNull();
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it("código inválido vindo do banco é ignorado; exceção inesperada nunca escapa", async () => {
    const ruim = banco({ ...tudoOk, pedido_token: { data: "../admin", error: null } });
    expect(await opcoesAutomaticasDoPedido(ruim.sb, pedido, deps(), 5000, "k")).toBeNull();
    const explode = banco({ ...tudoOk, pedidos_auto_disponivel: () => { throw new Error("rede caiu"); } });
    await expect(opcoesAutomaticasDoPedido(explode.sb, pedido, deps(), 5000, "k")).resolves.toBeNull();
  });

  it("sem a chave da automação, não busca", async () => {
    const antes = process.env.SHOPEE_SECRET;
    delete process.env.SHOPEE_SECRET;
    const d = deps();
    const { sb } = banco(tudoOk);
    const r = await opcoesAutomaticasDoPedido(sb, pedido, d);
    if (antes !== undefined) process.env.SHOPEE_SECRET = antes;
    expect(r).toBeNull();
    expect(d.buscarOfertas).not.toHaveBeenCalled();
  });
});
