// Configuração lida das variáveis de ambiente (veja .env.example).
// Nada aqui é segredo: a chave "anon"/"publishable" do Supabase é pública por
// definição — quem protege os dados são as políticas de acesso (RLS) do banco.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_CHAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
export const CONTATO_EMAIL = process.env.NEXT_PUBLIC_CONTATO_EMAIL ?? "";
export const RESPONSAVEL = process.env.NEXT_PUBLIC_RESPONSAVEL ?? "";
export const NOME_SITE = "OfertaSmart";

export const bancoConfigurado = () => /^https?:\/\/.+/.test(SUPABASE_URL) && SUPABASE_CHAVE_PUBLICA.length > 20;
