// Busca as opções de um pedido na Shopee e grava no banco (só o servidor faz isso, com a chave da automação).
import type { SupabaseClient } from "@supabase/supabase-js";
import { chaveDaAutomacao } from "./automacao";
import type { Database, Json } from "./database.types";
import { prepararOpcoes, type DepsOpcoes } from "./pedido-opcoes";
import { buscarOfertaPorItem, buscarOfertas, ErroShopee, gerarLinkCurto, interpretarEntrada, resolverLinkCurto, type Oferta } from "./shopee";

export const MSG_MIGRACAO_OPCOES = "As opções de pedido precisam da migração 0011 no Supabase (supabase/migrations/0011_pedido_opcoes.sql).";

/** Produto de um link da Shopee que a cliente mandou como exemplo (aceita link comprido, curto ou só o número). */
async function ofertaDoLink(referencia: string): Promise<Oferta | null> {
  const alvo = interpretarEntrada(referencia);
  if (alvo.tipo === "item") return buscarOfertaPorItem(alvo.itemId, alvo.shopId);
  if (alvo.tipo === "curto") {
    const ids = await resolverLinkCurto(alvo.url);
    return "erro" in ids ? null : buscarOfertaPorItem(ids.itemId, ids.shopId);
  }
  return null;
}

const depsReais: DepsOpcoes = {
  buscarOfertas: async (termo, ordem) => (await buscarOfertas({ termo, ordem, pagina: 1 })).ofertas,
  ofertaPorLink: ofertaDoLink,
  gerarLink: (url, ids) => gerarLinkCurto(url, ids),
};

export type ResultadoGeracao = { ok: true; quantidade: number; resumo: string } | { ok: false; erro: string };

/**
 * Procura, escolhe e grava as opções de um pedido. Serve ao botão do painel e, depois, à geração automática ao criar o pedido.
 * `deps` só muda nos testes.
 */
export async function gerarOpcoesDoPedido(
  sb: SupabaseClient<Database>,
  pedido: { id: string; descricao: string; referencia_url: string | null },
  termoManual: string | null,
  deps: DepsOpcoes = depsReais,
  chaveInformada?: string | null,
): Promise<ResultadoGeracao> {
  const chave = chaveInformada ?? (await chaveDaAutomacao());
  if (!chave) return { ok: false, erro: "Falta cadastrar SHOPEE_APP_ID e SHOPEE_SECRET no Worker do Cloudflare." };

  let r;
  try {
    r = await prepararOpcoes(pedido, termoManual, deps);
  } catch (e) {
    return { ok: false, erro: e instanceof ErroShopee ? e.message : "Não foi possível buscar na Shopee agora. Tente de novo em instantes." };
  }

  const { error } = await sb.rpc("pedido_gravar_opcoes", {
    p_chave: chave,
    p_pedido: pedido.id,
    p_termo: r.termo,
    p_resultado: r.resumo,
    p_opcoes: r.opcoes as unknown as Json,
  });
  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") return { ok: false, erro: MSG_MIGRACAO_OPCOES };
    if (error.code === "42501") return { ok: false, erro: "Chave da automação não registrada: abra qualquer página do painel e tente de novo." };
    return { ok: false, erro: `Não foi possível gravar as opções: ${error.message}` };
  }
  return { ok: true, quantidade: r.opcoes.length, resumo: r.resumo };
}
