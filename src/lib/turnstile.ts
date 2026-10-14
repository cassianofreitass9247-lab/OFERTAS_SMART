/**
 * Cloudflare Turnstile: o "não sou robô" do Cloudflare (gratuito, quase sempre invisível).
 *
 * Variáveis do Worker (Cloudflare > Workers > ofertasmart > Settings > Variables and Secrets):
 *   TURNSTILE_SITE_KEY    chave do site (pública, aparece na página)
 *   TURNSTILE_SECRET_KEY  chave secreta (tipo "Secret"; nunca no GitHub nem em NEXT_PUBLIC_*)
 *
 * Sem as duas, a verificação fica desligada e os formulários funcionam como antes.
 * Com só uma delas, os formulários recusam o envio (configuração incompleta não deve virar porta aberta).
 */

const URL_OFICIAL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TEMPO_MS = 8000;
const TAMANHO_MAX_TOKEN = 2048;

export type AcaoTurnstile = "pedido" | "login";
export type ResultadoTurnstile = { ok: true; ativo: boolean } | { ok: false; erro: string };
type Busca = (url: string, init: RequestInit) => Promise<Response>;
type Ambiente = Record<string, string | undefined>;

export const ERRO_VERIFICACAO = "Não conseguimos confirmar que você não é um robô. Aguarde a verificação de segurança e tente de novo.";
const ERRO_CONFIG = "A verificação de segurança está em manutenção. Tente de novo mais tarde.";

export function configTurnstile(env: Ambiente = process.env) {
  const siteKey = (env.TURNSTILE_SITE_KEY ?? "").trim();
  const secret = (env.TURNSTILE_SECRET_KEY ?? "").trim();
  return { siteKey, secret, ativo: Boolean(siteKey && secret), incompleto: Boolean(siteKey) !== Boolean(secret) };
}

/** Só para testes locais: permite apontar a verificação para um emulador em 127.0.0.1. */
function urlDeVerificacao(env: Ambiente) {
  const v = env.TURNSTILE_VERIFY_URL ?? "";
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(v) ? v : URL_OFICIAL;
}

export async function verificarTurnstile(
  token: string | null | undefined,
  acao: AcaoTurnstile,
  opcoes: { ip?: string | null; buscar?: Busca; env?: Ambiente } = {},
): Promise<ResultadoTurnstile> {
  const env = opcoes.env ?? process.env;
  const cfg = configTurnstile(env);
  if (cfg.incompleto) {
    console.error("Turnstile: configure TURNSTILE_SITE_KEY e TURNSTILE_SECRET_KEY juntas.");
    return { ok: false, erro: ERRO_CONFIG };
  }
  if (!cfg.ativo) return { ok: true, ativo: false };

  const t = (token ?? "").trim();
  if (!t || t.length > TAMANHO_MAX_TOKEN) return { ok: false, erro: ERRO_VERIFICACAO };

  const corpo = new URLSearchParams({ secret: cfg.secret, response: t });
  if (opcoes.ip) corpo.set("remoteip", opcoes.ip);

  try {
    const resposta = await (opcoes.buscar ?? fetch)(urlDeVerificacao(env), {
      method: "POST",
      body: corpo,
      signal: AbortSignal.timeout(TEMPO_MS),
    });
    const dados = (await resposta.json()) as { success?: boolean; action?: string; "error-codes"?: string[] };
    if (dados.success !== true) {
      if (dados["error-codes"]?.some((c) => c.includes("secret"))) console.error("Turnstile: chave secreta recusada", dados["error-codes"]);
      return { ok: false, erro: ERRO_VERIFICACAO };
    }
    // O token de um formulário não vale no outro.
    if (dados.action && dados.action !== acao) return { ok: false, erro: ERRO_VERIFICACAO };
    return { ok: true, ativo: true };
  } catch {
    return { ok: false, erro: ERRO_VERIFICACAO };
  }
}

async function sha256Hex(texto: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Chave que o servidor envia ao banco em cada pedido (derivada do segredo do Turnstile, que só o servidor
 * conhece). O banco guarda apenas o hash dela (hashDaChave), registrado pelo painel.
 */
export async function chaveDePedidos(env: Ambiente = process.env): Promise<string | null> {
  const { secret, ativo } = configTurnstile(env);
  return ativo ? sha256Hex(`vitrine-da-moni/pedidos/${secret}`) : null;
}

export const hashDaChave = (chave: string) => sha256Hex(chave);
