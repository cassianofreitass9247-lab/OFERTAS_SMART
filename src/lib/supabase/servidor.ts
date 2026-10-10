import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../database.types";
import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from "../config";

/** Cliente com a sessão do administrador (cookies). Usar apenas em páginas e ações do painel. */
export async function clienteServidor() {
  const jarra = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
    cookies: {
      getAll: () => jarra.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => jarra.set(name, value, options));
        } catch {
          // Em páginas (somente leitura) os cookies são renovados pelo middleware.
        }
      },
    },
  });
}
