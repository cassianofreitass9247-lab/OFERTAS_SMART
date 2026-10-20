import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const auto = vi.fn();
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/supabase/publico", () => ({ clientePublico: () => ({ rpc }) }));
vi.mock("@/lib/turnstile", () => ({ chaveDePedidos: async () => "chave-pedidos", verificarTurnstile: async () => ({ ok: true }) }));
vi.mock("@/lib/pedido-servidor", () => ({ opcoesAutomaticasDoPedido: (...a: unknown[]) => auto(...a) }));

import { enviarPedido } from "@/app/(site)/pedir/acoes";

const formulario = (extra: Record<string, string> = {}) => {
  const fd = new FormData();
  const base: Record<string, string> = { nome: "Ana Souza", whatsapp: "(84) 98777-0001", descricao: "Mochila rosa de rodinha", referencia: "", consentimento: "on", ...extra };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
};
const ID = "11111111-2222-3333-4444-555555555555";

beforeEach(() => {
  rpc.mockReset();
  auto.mockReset();
  rpc.mockResolvedValue({ data: ID, error: null });
});

describe("enviarPedido com busca automática", () => {
  it("achou opções: devolve o caminho da página do pedido", async () => {
    auto.mockResolvedValue({ token: "a".repeat(32), quantidade: 4 });
    const r = await enviarPedido({}, formulario());
    expect(r).toEqual({ ok: true, pagina: `/pedido/${"a".repeat(32)}`, quantidade: 4 });
    expect(auto).toHaveBeenCalledWith(expect.anything(), { id: ID, descricao: "Mochila rosa de rodinha", referencia_url: null });
  });

  it("sem opções (desligado, falha, demora): o pedido continua enviado, sem página", async () => {
    auto.mockResolvedValue(null);
    expect(await enviarPedido({}, formulario())).toEqual({ ok: true });
  });

  it("não busca se o pedido foi recusado", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001", hint: "limite_numero", message: "x" } });
    const r = await enviarPedido({}, formulario());
    expect(r.ok).toBeUndefined();
    expect(r.erro).toMatch(/3 pedidos hoje/);
    expect(auto).not.toHaveBeenCalled();
  });

  it("robô (campo escondido preenchido): finge sucesso sem gravar nem buscar", async () => {
    expect(await enviarPedido({}, formulario({ empresa: "spam" }))).toEqual({ ok: true });
    expect(rpc).not.toHaveBeenCalled();
    expect(auto).not.toHaveBeenCalled();
  });

  it("repassa o link de exemplo à busca", async () => {
    auto.mockResolvedValue(null);
    await enviarPedido({}, formulario({ referencia: "https://s.shopee.com.br/abc" }));
    expect(auto).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ referencia_url: "https://s.shopee.com.br/abc" }));
  });
});
