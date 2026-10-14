import { describe, expect, it, vi } from "vitest";
import { chaveDePedidos, configTurnstile, ERRO_VERIFICACAO, hashDaChave, verificarTurnstile } from "@/lib/turnstile";

const ATIVO = { TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "segredo" };
const resposta = (corpo: object) => vi.fn(async () => new Response(JSON.stringify(corpo)));

describe("Turnstile", () => {
  it("sem as chaves, fica desligado e não bloqueia", async () => {
    const buscar = resposta({ success: false });
    expect(await verificarTurnstile("", "pedido", { env: {}, buscar })).toEqual({ ok: true, ativo: false });
    expect(buscar).not.toHaveBeenCalled();
  });

  it("com só uma das chaves, recusa (configuração incompleta não vira porta aberta)", async () => {
    expect(configTurnstile({ TURNSTILE_SITE_KEY: "site" }).incompleto).toBe(true);
    const r = await verificarTurnstile("tok", "pedido", { env: { TURNSTILE_SECRET_KEY: "s" }, buscar: resposta({ success: true }) });
    expect(r.ok).toBe(false);
  });

  it("recusa token vazio ou grande demais sem consultar o Cloudflare", async () => {
    const buscar = resposta({ success: true });
    expect(await verificarTurnstile("", "pedido", { env: ATIVO, buscar })).toEqual({ ok: false, erro: ERRO_VERIFICACAO });
    expect(await verificarTurnstile("x".repeat(3000), "pedido", { env: ATIVO, buscar })).toEqual({ ok: false, erro: ERRO_VERIFICACAO });
    expect(buscar).not.toHaveBeenCalled();
  });

  it("envia segredo, token e IP para o endpoint oficial e aceita sucesso", async () => {
    const buscar = resposta({ success: true, action: "pedido" });
    expect(await verificarTurnstile("tok", "pedido", { env: ATIVO, buscar, ip: "1.2.3.4" })).toEqual({ ok: true, ativo: true });
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const corpo = init.body as URLSearchParams;
    expect([corpo.get("secret"), corpo.get("response"), corpo.get("remoteip")]).toEqual(["segredo", "tok", "1.2.3.4"]);
  });

  it("recusa falha, token de outro formulário e erro de rede", async () => {
    expect((await verificarTurnstile("tok", "pedido", { env: ATIVO, buscar: resposta({ success: false }) })).ok).toBe(false);
    expect((await verificarTurnstile("tok", "pedido", { env: ATIVO, buscar: resposta({ success: true, action: "login" }) })).ok).toBe(false);
    const quebrado = vi.fn(async () => {
      throw new Error("rede");
    });
    expect((await verificarTurnstile("tok", "login", { env: ATIVO, buscar: quebrado })).ok).toBe(false);
  });

  it("só aceita endereço de verificação alternativo em 127.0.0.1/localhost (testes)", async () => {
    const buscar = resposta({ success: true });
    await verificarTurnstile("tok", "pedido", { env: { ...ATIVO, TURNSTILE_VERIFY_URL: "https://malicioso.com/" }, buscar });
    await verificarTurnstile("tok", "pedido", { env: { ...ATIVO, TURNSTILE_VERIFY_URL: "http://127.0.0.1:54321/siteverify" }, buscar });
    expect(buscar.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      "http://127.0.0.1:54321/siteverify",
    ]);
  });

  it("chave dos pedidos é estável, depende do segredo e não é o segredo", async () => {
    const a = await chaveDePedidos(ATIVO);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await chaveDePedidos(ATIVO)).toBe(a);
    expect(await chaveDePedidos({ ...ATIVO, TURNSTILE_SECRET_KEY: "outro" })).not.toBe(a);
    expect(a).not.toContain("segredo");
    expect(await chaveDePedidos({})).toBeNull();
    expect(await hashDaChave("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
