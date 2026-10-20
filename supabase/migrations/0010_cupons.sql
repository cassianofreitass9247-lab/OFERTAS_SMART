-- Cupons: vouchers exclusivos do programa de afiliados da Shopee, cadastrados à mão (a API de afiliados não os expõe).
-- O público só vê cupom ativo e dentro da validade: o vencido some sozinho, sem rotina agendada.
create table public.cupons (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  -- Pelo menos um dos dois: o código para copiar ou o link de resgate (a pessoa resgata na Shopee).
  codigo text check (codigo ~ '^[A-Za-z0-9_.-]{2,40}$'),
  link_resgate text check (link_resgate ~ '^https://' and char_length(link_resgate) <= 2000),
  tipo text not null default 'outro' check (tipo in ('percentual', 'valor', 'frete', 'outro')),
  -- percentual: 1 a 100 (%); valor: reais; frete e outro: não usa.
  valor numeric(10, 2) check (valor > 0),
  -- Teto do desconto (ex.: "10% até R$ 20"), quando houver.
  teto numeric(10, 2) check (teto > 0),
  minimo_compra numeric(10, 2) check (minimo_compra >= 0),
  descricao text check (char_length(descricao) <= 500),
  categoria_id uuid references public.categorias (id) on delete set null,
  valido_de timestamptz not null default now(),
  valido_ate timestamptz not null,
  destaque boolean not null default false,
  ativo boolean not null default true,
  cliques integer not null default 0 check (cliques >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (codigo is not null or link_resgate is not null),
  check (valido_ate > valido_de),
  check (tipo <> 'percentual' or (valor is not null and valor <= 100)),
  check (tipo not in ('valor', 'percentual') or valor is not null)
);
create index cupons_vigencia_idx on public.cupons (valido_ate) where ativo;
create index cupons_categoria_idx on public.cupons (categoria_id) where ativo;

create function public.cupons_antes_de_gravar() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.atualizado_em := now();
  new.codigo := nullif(btrim(new.codigo), '');
  new.titulo := btrim(new.titulo);
  return new;
end;
$$;
create trigger cupons_antes_de_gravar
  before insert or update on public.cupons
  for each row execute function public.cupons_antes_de_gravar();

alter table public.cupons enable row level security;

create policy "publico ve cupons vigentes" on public.cupons
  for select to anon, authenticated
  using ((ativo and valido_de <= now() and valido_ate > now()) or (select public.eh_admin()));
create policy "admin insere cupons" on public.cupons
  for insert to authenticated with check ((select public.eh_admin()));
create policy "admin altera cupons" on public.cupons
  for update to authenticated using ((select public.eh_admin())) with check ((select public.eh_admin()));
create policy "admin exclui cupons" on public.cupons
  for delete to authenticated using ((select public.eh_admin()));

revoke all on public.cupons from anon, authenticated;
grant select on public.cupons to anon, authenticated;
grant insert, update, delete on public.cupons to authenticated;

-- Conta o uso (clique no link ou cópia do código) sem dados pessoais. Devolve o link de resgate (pode ser nulo,
-- quando o cupom só tem código). Só conta cupom vigente; para outros devolve nulo e não grava nada.
-- Devolve também se o cupom existe: a rota usa isso para diferenciar "sem link" de "cupom inexistente".
create function public.registrar_uso_cupom(p_cupom uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_link text;
  v_achou boolean;
begin
  update public.cupons c
     set cliques = least(c.cliques + 1, 2000000000)
   where c.id = p_cupom and c.ativo and c.valido_de <= now() and c.valido_ate > now()
  returning true, c.link_resgate into v_achou, v_link;

  if v_achou is null then
    return null;
  end if;
  return coalesce(v_link, '');
end;
$$;
revoke all on function public.registrar_uso_cupom(uuid) from public, anon, authenticated;
grant execute on function public.registrar_uso_cupom(uuid) to anon, authenticated;
