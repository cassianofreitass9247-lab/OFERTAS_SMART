"use server";

import { headers } from "next/headers";
import { pedidoSchema } from "@/lib/pedido";
import { opcoesAutomaticasDoPedido } from "@/lib/pedido-servidor";
import { clientePublico } from "@/lib/supabase/publico";
import { chaveDePedidos, verificarTurnstile } from "@/lib/turnstile";

/** `pagina` e `quantidade` só vêm quando a busca automática achou opções: o caminho secreto da página do pedido. */
export type EstadoPedido = { ok?: boolean; erro?: string; valores?: Record<string, string>; pagina?: string; quantidade?: number };

const texto = (fd: FormData, campo: string) => {
  const v = fd.get(campo);
  return typeof v === "string" ? v : "";
};

function comErro(fd: FormData, erro: string): EstadoPedido {
  const valores: Record<string, string> = {};
  for (const [campo, valor] of fd) if (typeof valor === "string" && campo !== "cf-turnstile-response") valores[campo] = valor;
  return { erro, valores };
}

export async function enviarPedido(_: EstadoPedido, fd: FormData): Promise<EstadoPedido> {
  // Armadilha para robôs: campo invisível para pessoas. Se vier preenchido, finge sucesso e descarta.
  if (texto(fd, "empresa")) return { ok: true };

  const r = pedidoSchema.safeParse({
    nome: texto(fd, "nome"),
    whatsapp: texto(fd, "whatsapp"),
    descricao: texto(fd, "descricao"),
    referencia: texto(fd, "referencia"),
    consentimento: fd.get("consentimento") === "on",
  });
  if (!r.success) return comErro(fd, r.error.issues[0]?.message ?? "Confira os dados do pedido.");

  const robo = await verificarTurnstile(texto(fd, "cf-turnstile-response"), "pedido", {
    ip: (await headers()).get("cf-connecting-ip"),
  });
  if (!robo.ok) return comErro(fd, robo.erro);

  const sb = clientePublico();
  if (!sb) return comErro(fd, "Os pedidos ainda não estão funcionando. Tente mais tarde.");

  const { data: pedidoId, error } = await sb.rpc("criar_pedido", {
    p_nome: r.data.nome,
    p_whatsapp: r.data.whatsapp,
    p_descricao: r.data.descricao,
    p_referencia: r.data.referencia,
    p_consentimento: r.data.consentimento,
    p_chave: await chaveDePedidos(),
  });
  if (error) {
    if (error.hint === "chave") {
      console.error("criar_pedido recusou a chave do servidor: abra o painel para sincronizar a chave do Turnstile.");
      return comErro(fd, "Não foi possível enviar o pedido agora. Tente de novo em instantes.");
    }
    if (error.hint === "limite_numero") return comErro(fd, "Você já fez 3 pedidos hoje com este número. A Moni responde esses primeiro; tente de novo amanhã.");
    if (error.hint === "limite_geral") return comErro(fd, "Muitos pedidos chegaram agora. Tente de novo daqui a pouco.");
    if (error.code === "22023") return comErro(fd, error.message);
    return comErro(fd, "Não foi possível enviar o pedido agora. Tente de novo em instantes.");
  }

  // Busca automática (se a administradora ligou no painel): o pedido já está salvo, então qualquer falha aqui só
  // significa que a Moni responde pelo caminho manual.
  if (typeof pedidoId === "string") {
    const auto = await opcoesAutomaticasDoPedido(sb, { id: pedidoId, descricao: r.data.descricao, referencia_url: r.data.referencia });
    if (auto) return { ok: true, pagina: `/pedido/${auto.token}`, quantidade: auto.quantidade };
  }
  return { ok: true };
}
