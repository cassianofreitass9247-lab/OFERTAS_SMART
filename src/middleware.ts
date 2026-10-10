import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { bancoConfigurado, SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from "@/lib/config";

// Protege tudo em /admin: sem sessão válida, só a tela de login abre.
export async function middleware(req: NextRequest) {
  if (!bancoConfigurado()) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        lista.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const naTelaDeLogin = req.nextUrl.pathname === "/admin/login";

  if (!data.user && !naTelaDeLogin) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  if (data.user && naTelaDeLogin) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
  return res;
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
