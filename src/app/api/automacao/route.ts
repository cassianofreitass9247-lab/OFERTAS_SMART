import { chaveDaAutomacao, chavesIguais, executarAutomacao } from "@/lib/automacao";
import { sincronizarPrecos } from "@/lib/precos";
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
    const agendada = req.headers.get("x-automacao-agendada") === "1";
    const r = await executarAutomacao(sb, chave, { agendada });
    // Nas horas em que a importação não roda, o agendamento aproveita para conferir os preços (orçamento de chamadas separado).
    if (agendada && r.status === "fora_do_horario") return Response.json({ ...r, precos: await sincronizarPrecos(sb, chave) });
    return Response.json(r);
  } catch (e) {
    console.error("automação:", e instanceof Error ? e.message : e);
    return Response.json({ status: "erro", erro: "Falha inesperada." }, { status: 500 });
  }
}
