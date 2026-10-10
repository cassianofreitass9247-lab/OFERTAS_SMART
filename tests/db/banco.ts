// Sobe um PostgreSQL em memória (PGlite), imita o mínimo do Supabase
// (papéis anon/authenticated e auth.uid()) e aplica as migrações reais.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const PRELUDIO = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
`;

export const ADMIN = "11111111-1111-1111-1111-111111111111";
export const COMUM = "22222222-2222-2222-2222-222222222222";

export async function criarBanco() {
  const db = new PGlite();
  await db.exec(PRELUDIO);
  const pasta = path.resolve(__dirname, "../../supabase/migrations");
  for (const arquivo of readdirSync(pasta).sort()) {
    await db.exec(readFileSync(path.join(pasta, arquivo), "utf8"));
  }
  await db.exec(`
    insert into auth.users (id, email) values ('${ADMIN}', 'admin@teste'), ('${COMUM}', 'comum@teste');
    insert into public.administradores (user_id) values ('${ADMIN}');
  `);
  return db;
}

type Papel = "anon" | "admin" | "comum";

/** Executa SQL como um visitante anônimo, um usuário comum ou o administrador. */
export async function como<T = Record<string, unknown>>(db: PGlite, papel: Papel, sql: string, params: unknown[] = []) {
  const role = papel === "anon" ? "anon" : "authenticated";
  const sub = papel === "admin" ? ADMIN : papel === "comum" ? COMUM : "";
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${sub}', false);`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

export async function inserirProduto(db: PGlite, campos: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    nome: "Produto de teste",
    slug: "produto-" + Math.random().toString(36).slice(2, 10),
    preco_atual: 100,
    link_afiliado: "https://s.shopee.com.br/" + Math.random().toString(36).slice(2, 10),
    status_publicacao: "publicado",
    ...campos,
  };
  const cols = Object.keys(base);
  const rows = await como<{ id: string }>(
    db,
    "admin",
    `insert into public.produtos (${cols.join(",")}) values (${cols.map((_, i) => "$" + (i + 1)).join(",")}) returning id`,
    Object.values(base),
  );
  return rows[0].id;
}
