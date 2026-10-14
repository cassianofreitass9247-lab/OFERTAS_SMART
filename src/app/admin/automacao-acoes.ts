"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin";
import { chaveDaAutomacao, executarAutomacao } from "@/lib/automacao";

const PAGINA = "/admin/automacao";
const voltar = (tipo: "ok" | "erro", msg: string): never => redirect(`${PAGINA}?${tipo}=${encodeURIComponent(msg)}`);
const num = (fd: FormData, campo: string, min: number, max: number, inteiro = true) => {
  const v = fd.get(campo);
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return inteiro ? Math.trunc(n) : n;
};
const MSG_MIGRACAO = "O modo automático precisa da migração 0006 no Supabase (supabase/migrations/0006_automacao.sql).";

export async function salvarAutomacao(fd: FormData) {
  const sb = await exigirAdmin();
  const limite = num(fd, "limite_diario", 1, 60);
  const vendas = num(fd, "vendas_min", 0, 10_000_000);
  const nota = num(fd, "nota_min", 0, 5, false);
  const desconto = num(fd, "desconto_min", 0, 100);
  const comissao = num(fd, "comissao_min", 0, 100, false);
  if (limite === null || vendas === null || nota === null || desconto === null || comissao === null) {
    return voltar("erro", "Confira os números: limite de 1 a 60, nota de 0 a 5, descontos e comissão de 0 a 100.");
  }
  const { error } = await sb
    .from("automacao_config")
    .update({ limite_diario: limite, vendas_min: vendas, nota_min: nota, desconto_min: desconto, comissao_min: comissao, atualizado_em: new Date().toISOString() })
    .eq("id", 1);
  if (error) return voltar("erro", error.code === "42P01" ? MSG_MIGRACAO : `Não foi possível salvar: ${error.message}`);
  revalidatePath(PAGINA);
  return voltar("ok", "Configuração salva.");
}

export async function alternarAutomacao(fd: FormData) {
  const sb = await exigirAdmin();
  const ligar = fd.get("ativo") === "true";
  if (ligar && !(await chaveDaAutomacao())) {
    return voltar("erro", "Falta cadastrar SHOPEE_APP_ID e SHOPEE_SECRET no Worker do Cloudflare.");
  }
  const { error } = await sb
    .from("automacao_config")
    .update({ ativo: ligar, ...(ligar ? { erros_seguidos: 0, pausado_motivo: null } : {}), atualizado_em: new Date().toISOString() })
    .eq("id", 1);
  if (error) return voltar("erro", error.code === "42P01" ? MSG_MIGRACAO : `Não foi possível alterar: ${error.message}`);
  revalidatePath(PAGINA);
  return voltar("ok", ligar ? "Automação ligada. A próxima execução é amanhã às 9h (Brasília); para testar agora, use \"Rodar agora\"." : "Automação pausada.");
}

/** Executa a rotina agora, com a mesma lógica do agendamento (precisa estar ligada). */
export async function rodarAutomacaoAgora() {
  const sb = await exigirAdmin();
  const chave = await chaveDaAutomacao();
  if (!chave) return voltar("erro", "Falta cadastrar SHOPEE_APP_ID e SHOPEE_SECRET no Worker do Cloudflare.");
  const r = await executarAutomacao(sb, chave);
  revalidatePath("/", "layout");
  if (r.status === "pausada") return voltar("erro", "A automação está pausada. Ligue-a antes de rodar.");
  if (r.status === "limite") return voltar("ok", `Limite diário já atingido (${r.criadosHoje} hoje). Nada a fazer.`);
  if (r.status === "erro") {
    const dica = /Acesso negado/i.test(r.erro) ? " Abra qualquer página do painel e tente de novo (a chave é registrada ao abrir o painel; exige a migração 0006)." : "";
    return voltar("erro", `A execução falhou: ${r.erro}.${dica}`.slice(0, 280));
  }
  return voltar("ok", `Execução concluída: ${r.criados} publicado(s) de ${r.consultadas} produto(s) consultados${r.falhas ? `; ${r.falhas} categoria(s) falharam` : ""}.`);
}
