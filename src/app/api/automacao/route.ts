import { chaveDaAutomacao, chavesIguais, executarAutomacao } from "@/lib/automacao";
import { clientePublico } from "@/lib/supabase/publico";

export const dynamic = "force-dynamic";

/**
 * Chamado só pelo agendamento do Cloudflare (worker.ts), de hora em hora (o banco decide se é a vez de rodar, conforme os dias e a hora escolhidos no painel). Exige o cabeçalho com a chave derivada do
 * segredo da Shopee; sem ela (ou com chave errada) responde 401 e não faz nada.
 */
export async function POST(req: Request) {
  const chave = await chaveDaAutomacao();
  const enviada = req.headers.get("x-automacao-chave") ?? "";
  if (!chave || !chavesIguais(enviada, chave)) return new Response("Não autorizado", { status: 401 });
  const sb = clientePublico();
  if (!sb) return new Response("Banco não configurado", { status: 503 });
  try {
    return Response.json(await executarAutomacao(sb, chave, { agendada: req.headers.get("x-automacao-agendada") === "1" }));
  } catch (e) {
    console.error("automação:", e instanceof Error ? e.message : e);
    return Response.json({ status: "erro", erro: "Falha inesperada." }, { status: 500 });
  }
}
