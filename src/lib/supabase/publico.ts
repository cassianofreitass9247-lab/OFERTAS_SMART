import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { bancoConfigurado, SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from "../config";

let cliente: SupabaseClient<Database> | null = null;

/** Cliente anônimo (visitante), sem cookies. Devolve null se o banco ainda não foi configurado. */
export function clientePublico(): SupabaseClient<Database> | null {
  if (!bancoConfigurado()) return null;
  cliente ??= createClient<Database>(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cliente;
}
