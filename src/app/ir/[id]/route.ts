import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lerLocal } from "@/lib/local";
import { linkAfiliadoValido } from "@/lib/produto";
import { clientePublico } from "@/lib/supabase/publico";
import { EH_UUID, limparRotulo } from "@/lib/texto";

export const dynamic = "force-dynamic";

// /ir/<id do produto>?canal=telegram&campanha=semana-1
// Registra o clique (sem IP nem identificador; só o local aproximado) e leva a pessoa ao link de afiliado.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const naoEncontrado = () => NextResponse.redirect(new URL("/ofertas", req.url), { status: 302, headers: { "X-Robots-Tag": "noindex" } });

  const sb = clientePublico();
  if (!sb || !EH_UUID.test(id)) return naoEncontrado();

  // Local aproximado (país, estado, cidade) pelo IP, lido pela Cloudflare. O IP não é guardado.
  // Fora do Cloudflare (ambiente local), não há local e o clique é registrado sem ele.
  let local = lerLocal(null);
  try {
    local = lerLocal(getCloudflareContext<Record<string, unknown>>().cf);
  } catch {
    /* sem contexto da Cloudflare */
  }

  const { data: link, error } = await sb.rpc("registrar_clique", {
    p_produto: id,
    p_canal: limparRotulo(req.nextUrl.searchParams.get("canal"), 40) ?? "site",
    p_campanha: limparRotulo(req.nextUrl.searchParams.get("campanha"), 80),
    p_pais: local.pais,
    p_estado: local.estado,
    p_cidade: local.cidade,
  });

  // Defesa extra: só redireciona para domínio oficial, mesmo que o banco tenha outro valor.
  if (error || !link || !linkAfiliadoValido(link)) return naoEncontrado();

  return NextResponse.redirect(link, {
    status: 302,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
