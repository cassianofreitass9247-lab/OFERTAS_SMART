import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";

/**
 * Toda ação do painel confere a sessão e a permissão de administradora antes de agir.
 * Mesmo que esta conferência falhasse, as políticas do banco (RLS) recusariam a gravação.
 * Fica fora dos arquivos "use server" de propósito: aqui não vira um endereço chamável de fora.
 */
export async function exigirAdmin() {
  const sb = await clienteServidor();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/admin/login");
  const { data: admin } = await sb.rpc("eh_admin");
  if (!admin) redirect("/admin");
  return sb;
}
