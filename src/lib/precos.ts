import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { buscarOfertaPorItem, precoDaOferta } from "./shopee";

/**
 * Sincronização de preços: confere na Shopee o preço dos produtos publicados (os mais antigos na fila primeiro) e grava o novo preço
 * pelo banco. A queda aparece sozinha em "Radar de ofertas" pelo gatilho que já existe. Roda a cada hora (agendamento do Cloudflare)
 * nas horas em que a automação de importação não está rodando, e pelo botão "Conferir preços agora".
 *
 * Orçamento: 1 consulta à Shopee por produto + 2 ao banco; o plano gratuito do Cloudflare permite ~50 chamadas externas por execução.
 */
type Ambiente = Record<string, string | undefined>;
type Cliente = SupabaseClient<Database>;

export const PRODUTOS_POR_EXECUCAO = 35;

export type ResultadoPrecos =
  | { status: "ok"; conferidos: number; quedas: number; altas: number; suspeitos: number; ausentes: number; parouPor?: string }
  | { status: "nada_a_conferir" }
  | { status: "erro"; erro: string };

type Pendente = { id_externo: string; preco_atual: number };

export async function sincronizarPrecos(
  sb: Cliente,
  chave: string,
  opcoes: { env?: Ambiente; buscar?: (url: string, init: RequestInit) => Promise<Response>; agora?: () => number; limite?: number } = {},
): Promise<ResultadoPrecos> {
  const { data, error } = await sb.rpc("precos_pendentes", { p_chave: chave, p_limite: opcoes.limite ?? PRODUTOS_POR_EXECUCAO });
  if (error) return { status: "erro", erro: error.message };
  const pendentes = (data ?? []) as unknown as Pendente[];
  if (pendentes.length === 0) {
    // Lista vazia: a conferência está desligada ou não há produtos publicados da Shopee. Não há o que consultar.
    return { status: "nada_a_conferir" };
  }

  const itens: { id_externo: string; preco: number | null }[] = [];
  let parouPor: string | undefined;
  for (const p of pendentes) {
    const [shopId, itemId] = p.id_externo.split(".");
    try {
      const o = await buscarOfertaPorItem(itemId, shopId, { env: opcoes.env, buscar: opcoes.buscar, agora: opcoes.agora });
      itens.push({ id_externo: p.id_externo, preco: o ? precoDaOferta(o) : null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro";
      // Limite de consultas, credencial recusada ou erro geral: para aqui e grava o que já foi conferido.
      parouPor = msg;
      break;
    }
  }

  if (itens.length === 0) {
    await sb.rpc("precos_falha", { p_chave: chave, p_msg: parouPor ?? "A Shopee não respondeu." });
    return { status: "erro", erro: parouPor ?? "A Shopee não respondeu." };
  }
  const { data: r, error: erroAplicar } = await sb.rpc("precos_aplicar", { p_chave: chave, p_itens: itens });
  if (erroAplicar) return { status: "erro", erro: erroAplicar.message };
  const x = r as unknown as { conferidos: number; quedas: number; altas: number; suspeitos: number; ausentes: number };
  return { status: "ok", ...x, ...(parouPor ? { parouPor } : {}) };
}
