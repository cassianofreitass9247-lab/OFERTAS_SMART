/**
 * Entrada do Worker: o site (OpenNext) + o agendamento diário da automação (Cron Trigger).
 * O agendamento só chama a rota interna /api/automacao do próprio site, com a chave derivada do segredo da Shopee
 * (a mesma que o painel registra no banco). Nada de segredo vai para o GitHub.
 */
import handler from "./.open-next/worker.js";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

type Ambiente = { SHOPEE_SECRET?: string } & Record<string, unknown>;

async function chaveDaAutomacao(segredo: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`vitrine-da-moni/automacao/${segredo}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const entrada = {
  fetch: handler.fetch,

  async scheduled(_evento: unknown, env: Ambiente, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const segredo = (env.SHOPEE_SECRET ?? "").trim();
    if (!segredo) return; // sem Shopee configurada, a automação não existe
    const pedido = new Request("https://ofertasmart.vitrinedamoni.workers.dev/api/automacao", {
      method: "POST",
      headers: { "x-automacao-chave": await chaveDaAutomacao(segredo) },
    });
    ctx.waitUntil(
      (async () => {
        const r = await handler.fetch(pedido, env, ctx);
        console.log("automacao:", r.status, (await r.text()).slice(0, 300));
      })(),
    );
  },
};
export default entrada;
