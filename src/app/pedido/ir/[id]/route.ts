import { NextResponse, type NextRequest } from "next/server";
import { linkAfiliadoValido } from "@/lib/produto";
import { clientePublico } from "@/lib/supabase/publico";
import { EH_UUID } from "@/lib/texto";

export const dynamic = "force-dynamic";

// /pedido/ir/<id da opção>: conta o clique (sem dados pessoais) e leva a pessoa ao link de afiliado da opção.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cabecalhos = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  const naoEncontrado = () => NextResponse.redirect(new URL("/ofertas", req.url), { status: 302, headers: cabecalhos });

  const sb = clientePublico();
  if (!sb || !EH_UUID.test(id)) return naoEncontrado();
  const { data: link, error } = await sb.rpc("registrar_clique_opcao", { p_opcao: id });
  // Defesa extra: só redireciona para domínio oficial, mesmo que o banco tenha outro valor.
  if (error || !link || !linkAfiliadoValido(link)) return naoEncontrado();
  return NextResponse.redirect(link, { status: 302, headers: cabecalhos });
}
