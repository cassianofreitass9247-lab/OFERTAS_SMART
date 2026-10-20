"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { SITE_URL } from "@/lib/config";
import { enderecoDoPedido } from "@/lib/pedido-opcoes";
import { gerarOpcoesDoPedido, MSG_MIGRACAO_AUTO, MSG_MIGRACAO_OPCOES } from "@/lib/pedido-servidor";
import { EH_UUID } from "@/lib/texto";

const texto = (fd: FormData, campo: string) => {
  const v = fd.get(campo);
  return typeof v === "string" ? v : "";
};
const voltar = (tipo: "ok" | "erro", msg: string): never => redirect(`/admin/pedidos?status=novo&${tipo}=${encodeURIComponent(msg)}`);

/** Botão "Buscar opções": procura na Shopee, escolhe 3 a 5 produtos variados e gera os links com o identificador do pedido. */
export async function buscarOpcoesPedido(fd: FormData) {
  const sb = await exigirAdmin();
  const id = texto(fd, "id");
  if (!EH_UUID.test(id)) return voltar("erro", "Pedido inválido.");
  const termo = texto(fd, "termo").trim().slice(0, 100);

  const { data: pedido, error } = await sb.from("pedidos").select("id, descricao, referencia_url").eq("id", id).maybeSingle();
  if (error || !pedido) return voltar("erro", "Pedido não encontrado.");

  const r = await gerarOpcoesDoPedido(sb, pedido, termo || null);
  revalidatePath("/admin/pedidos");
  if (!r.ok) return voltar("erro", r.erro.slice(0, 280));
  return voltar(r.quantidade ? "ok" : "erro", r.resumo.slice(0, 280));
}

/** Chamada ao tocar em "Enviar pelo WhatsApp": marca o pedido como respondido e guarda o endereço da página enviada. */
export async function marcarOpcoesEnviadas(id: string): Promise<{ erro?: string }> {
  const sb = await exigirAdmin();
  if (!EH_UUID.test(id)) return { erro: "Pedido inválido." };
  const { data: pedido, error } = await sb.from("pedidos").select("token").eq("id", id).maybeSingle();
  if (error) return { erro: /token/.test(error.message) ? MSG_MIGRACAO_OPCOES : `Não foi possível ler o pedido: ${error.message}` };
  if (!pedido?.token) return { erro: "Pedido não encontrado." };
  const { error: e2 } = await sb
    .from("pedidos")
    .update({ status: "respondido", produto_id: null, link_enviado: enderecoDoPedido(SITE_URL, pedido.token), respondido_em: new Date().toISOString() })
    .eq("id", id);
  if (e2) return { erro: `Não foi possível marcar como respondido: ${e2.message}` };
  revalidatePath("/admin", "layout");
  return {};
}

/** Interruptor "Busca automática ao receber o pedido". */
export async function definirBuscaAutomatica(fd: FormData) {
  const sb = await exigirAdmin();
  const ligar = texto(fd, "ligar") === "sim";
  const { error } = await sb.rpc("definir_pedidos_auto", { p_ligado: ligar });
  if (error) {
    return voltar("erro", error.code === "42883" || error.code === "PGRST202" ? MSG_MIGRACAO_AUTO : `Não foi possível alterar: ${error.message}`);
  }
  revalidatePath("/admin/pedidos");
  return voltar("ok", ligar ? "Busca automática ligada: pedidos novos já recebem as opções na hora." : "Busca automática desligada: os pedidos voltam a depender do botão Buscar opções.");
}
