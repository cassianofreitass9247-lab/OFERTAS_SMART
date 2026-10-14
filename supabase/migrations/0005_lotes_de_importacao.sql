-- Vitrine da Moni — migração 0005: lotes de importação da Shopee
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Execute uma única vez, depois da 0004. Não apaga nem altera dados existentes.
--
-- Cada importação em lote vira um registro em lotes_importacao, e os produtos criados nela guardam
-- o lote_id. Isso permite ver o que entrou em cada lote e desfazer o lote inteiro
-- (despublicar os produtos ou apagar os rascunhos), principalmente quando o lote foi publicado direto.

create table public.lotes_importacao (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  criado_por uuid,
  publicado_direto boolean not null default false,
  total integer not null check (total >= 0),
  -- Em publicação direta, produtos com palavra bloqueada entram como rascunho.
  retidos_por_bloqueio integer not null default 0 check (retidos_por_bloqueio >= 0),
  filtros jsonb not null default '{}'::jsonb
);

alter table public.lotes_importacao enable row level security;
revoke all on public.lotes_importacao from public, anon, authenticated;
grant select, insert on public.lotes_importacao to authenticated;

create policy "admin ve lotes" on public.lotes_importacao
  for select to authenticated using ((select public.eh_admin()));
create policy "admin registra lotes" on public.lotes_importacao
  for insert to authenticated with check ((select public.eh_admin()));

alter table public.produtos
  add column lote_id uuid references public.lotes_importacao (id) on delete set null;
create index produtos_lote_idx on public.produtos (lote_id) where lote_id is not null;
