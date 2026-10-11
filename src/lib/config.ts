// Configuração lida das variáveis de ambiente (veja .env.example).
// Nada aqui é segredo: a chave "anon"/"publishable" do Supabase é pública por
// definição — quem protege os dados são as políticas de acesso (RLS) do banco.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_CHAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
export const CONTATO_EMAIL = process.env.NEXT_PUBLIC_CONTATO_EMAIL ?? "";
export const RESPONSAVEL = process.env.NEXT_PUBLIC_RESPONSAVEL ?? "";
export const NOME_SITE = "Vitrine da Moni";

// Redes da Moni. Para trocar, altere aqui.
export const INSTAGRAM_USUARIO = "moniquealbc_";
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_USUARIO}/`;
export const WHATSAPP_URL = "https://wa.me/5584987779782";

// Grupo do Telegram: só aparece no site quando a variável tiver um link https://t.me/...
const telegram = process.env.NEXT_PUBLIC_TELEGRAM_URL ?? "";
export const TELEGRAM_URL = /^https:\/\/t\.me\/[\w+/-]+$/.test(telegram) ? telegram : "";

export const bancoConfigurado = () => /^https?:\/\/.+/.test(SUPABASE_URL) && SUPABASE_CHAVE_PUBLICA.length > 20;
