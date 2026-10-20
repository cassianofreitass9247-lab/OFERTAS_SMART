import { NextResponse, type NextRequest } from "next/server";
import { linkAfiliadoValido } from "@/lib/produto";
import { clientePublico } from "@/lib/supabase/publico";
import { EH_UUID } from "@/lib/texto";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

async function contar(id: string): Promise<string | null> {
  const sb = clientePublico();
  if (!sb || !EH_UUID.test(id)) return null;
  const { data, error } = await sb.rpc("registrar_uso_cupom", { p_cupom: id });
  return error ? null : data;
}

// /cupom/<id>: conta o uso (sem dados pessoais) e leva a pessoa ao link de resgate do cupom na Shopee.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const link = await contar((await params).id);
  // Defesa extra: só redireciona para domínio oficial, mesmo que o banco tenha outro valor.
  if (!link || !linkAfiliadoValido(link)) {
    return NextResponse.redirect(new URL("/cupons", req.url), { status: 302, headers: SEM_CACHE });
  }
  return NextResponse.redirect(link, { status: 302, headers: SEM_CACHE });
}

// POST /cupom/<id>: só conta a cópia do código (chamado pelo botão "Copiar código").
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await contar((await params).id);
  return new NextResponse(null, { status: 204, headers: SEM_CACHE });
}
