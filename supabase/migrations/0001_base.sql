-- OfertaSmart — migração 0001: base (categorias, produtos, históricos, cliques, importações)
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Pode ser executada uma única vez em um projeto novo.

create type public.origem_produto as enum ('manual', 'csv', 'shopee_api', 'demo');
create type public.disponibilidade_produto as enum ('disponivel', 'indisponivel', 'desconhecido');
create type public.status_publicacao as enum ('rascunho', 'publicado', 'despublicado');

-- ---------------------------------------------------------------------------
-- Administradores
-- ---------------------------------------------------------------------------
create table public.administradores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

create function public.eh_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.administradores a where a.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------------
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  descricao text check (char_length(descricao) <= 500),
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Produtos
-- ---------------------------------------------------------------------------
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 3 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  descricao text check (char_length(descricao) <= 5000),
  imagem_url text check (imagem_url ~ '^https://'),
  categoria_id uuid references public.categorias (id) on delete set null,
  preco_atual numeric(12, 2) not null check (preco_atual > 0),
  -- Preço anterior: nunca é digitado. Vem do nosso próprio histórico (queda de
  -- preço registrada) ou, no futuro, da API oficial. Ver gatilho abaixo.
  preco_anterior numeric(12, 2) check (preco_anterior > 0),
  preco_anterior_fonte text check (preco_anterior_fonte in ('historico_proprio', 'shopee_api')),
  preco_anterior_em timestamptz,
  desconto_percentual integer generated always as (
    case
      when preco_anterior is not null and preco_anterior > preco_atual
        then round((1 - preco_atual / preco_anterior) * 100)::integer
    end
  ) stored,
  link_afiliado text not null check (link_afiliado ~ '^https://'),
  id_externo text,
  origem public.origem_produto not null default 'manual',
  ficticio boolean not null default false,
  disponibilidade public.disponibilidade_produto not null default 'desconhecido',
  status_publicacao public.status_publicacao not null default 'rascunho',
  destaque boolean not null default false,
  preco_atualizado_em timestamptz not null default now(),
  origem_atualizada_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Dado fictício só existe com origem "demo", e vice-versa.
  constraint produtos_ficticio_somente_demo check (ficticio = (origem = 'demo')),
  constraint produtos_preco_anterior_completo check (
    (preco_anterior is null and preco_anterior_fonte is null and preco_anterior_em is null)
    or (preco_anterior is not null and preco_anterior_fonte is not null and preco_anterior_em is not null)
  )
);

-- Proteção contra duplicados
create unique index produtos_link_afiliado_unico on public.produtos (link_afiliado);
create unique index produtos_id_externo_unico on public.produtos (id_externo) where id_externo is not null;
create index produtos_publicacao_idx on public.produtos (status_publicacao, criado_em desc);
create index produtos_categoria_idx on public.produtos (categoria_id);

create table public.historico_precos (
  id bigint generated always as identity primary key,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  preco numeric(12, 2) not null,
  registrado_em timestamptz not null default now()
);
create index historico_precos_produto_idx on public.historico_precos (produto_id, registrado_em desc);

create table public.historico_alteracoes (
  id bigint generated always as identity primary key,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  campo text not null,
  valor_antigo text,
  valor_novo text,
  alterado_por uuid,
  alterado_em timestamptz not null default now()
);
create index historico_alteracoes_produto_idx on public.historico_alteracoes (produto_id, alterado_em desc);

-- Regras do preço anterior e datas (antes de gravar)
create function public.produtos_antes_de_gravar() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.preco_atualizado_em := now();
    if new.origem <> 'shopee_api' then
      new.preco_anterior := null;
      new.preco_anterior_fonte := null;
      new.preco_anterior_em := null;
    end if;
    return new;
  end if;

  new.atualizado_em := now();
  if new.preco_atual is distinct from old.preco_atual then
    new.preco_atualizado_em := now();
  end if;

  if new.origem <> 'shopee_api' then
    if new.preco_atual < old.preco_atual then
      -- Queda de preço: o preço que nós mesmos registramos vira o "de".
      new.preco_anterior := old.preco_atual;
      new.preco_anterior_fonte := 'historico_proprio';
      new.preco_anterior_em := old.preco_atualizado_em;
    elsif new.preco_atual > old.preco_atual then
      new.preco_anterior := null;
      new.preco_anterior_fonte := null;
      new.preco_anterior_em := null;
    elsif new.preco_anterior is null then
      -- Preço igual: é permitido apenas REMOVER o preço anterior (correção).
      new.preco_anterior_fonte := null;
      new.preco_anterior_em := null;
    else
      -- Qualquer valor digitado é ignorado.
      new.preco_anterior := old.preco_anterior;
      new.preco_anterior_fonte := old.preco_anterior_fonte;
      new.preco_anterior_em := old.preco_anterior_em;
    end if;
  end if;
  return new;
end;
$$;

create trigger produtos_antes_de_gravar
before insert or update on public.produtos
for each row execute function public.produtos_antes_de_gravar();

-- Históricos (depois de gravar)
create function public.produtos_registrar_historico() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_quem uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.historico_precos (produto_id, preco) values (new.id, new.preco_atual);
    return null;
  end if;

  if new.preco_atual is distinct from old.preco_atual then
    insert into public.historico_precos (produto_id, preco) values (new.id, new.preco_atual);
  end if;

  insert into public.historico_alteracoes (produto_id, campo, valor_antigo, valor_novo, alterado_por)
  select new.id, c.campo, c.antigo, c.novo, v_quem
  from (values
    ('nome', old.nome, new.nome),
    ('descricao', old.descricao, new.descricao),
    ('imagem_url', old.imagem_url, new.imagem_url),
    ('categoria_id', old.categoria_id::text, new.categoria_id::text),
    ('preco_atual', old.preco_atual::text, new.preco_atual::text),
    ('link_afiliado', old.link_afiliado, new.link_afiliado),
    ('disponibilidade', old.disponibilidade::text, new.disponibilidade::text),
    ('status_publicacao', old.status_publicacao::text, new.status_publicacao::text),
    ('destaque', old.destaque::text, new.destaque::text)
  ) as c (campo, antigo, novo)
  where c.antigo is distinct from c.novo;
  return null;
end;
$$;

create trigger produtos_registrar_historico
after insert or update on public.produtos
for each row execute function public.produtos_registrar_historico();

-- ---------------------------------------------------------------------------
-- Cliques (sem dados pessoais: não guarda IP, navegador nem identificador)
-- ---------------------------------------------------------------------------
create table public.cliques (
  id bigint generated always as identity primary key,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  canal text not null default 'site' check (char_length(canal) <= 40),
  campanha text check (char_length(campanha) <= 80),
  criado_em timestamptz not null default now()
);
create index cliques_produto_idx on public.cliques (produto_id, criado_em desc);
create index cliques_data_idx on public.cliques (criado_em desc);

-- Registra o clique e devolve o link de afiliado. Só funciona para produto
-- publicado e real (nunca para dado fictício).
create function public.registrar_clique(p_produto uuid, p_canal text default 'site', p_campanha text default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_link text;
begin
  select p.link_afiliado into v_link
  from public.produtos p
  where p.id = p_produto and p.status_publicacao = 'publicado' and not p.ficticio;

  if v_link is null then
    return null;
  end if;

  insert into public.cliques (produto_id, canal, campanha)
  values (
    p_produto,
    left(coalesce(nullif(btrim(p_canal), ''), 'site'), 40),
    left(nullif(btrim(p_campanha), ''), 80)
  );
  return v_link;
end;
$$;

-- ---------------------------------------------------------------------------
-- Importações por CSV
-- ---------------------------------------------------------------------------
create table public.importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo_nome text,
  total integer not null default 0,
  inseridos integer not null default 0,
  atualizados integer not null default 0,
  rejeitados integer not null default 0,
  erros jsonb not null default '[]'::jsonb,
  criado_por uuid,
  criado_em timestamptz not null default now()
);

-- Importa em uma única transação: ou entra tudo que é válido, ou nada.
-- Produto já existente (mesmo id_externo ou mesmo link) é atualizado, não duplicado.
create function public.importar_produtos(
  p_itens jsonb,
  p_arquivo text default null,
  p_rejeitados integer default 0,
  p_erros jsonb default '[]'::jsonb
) returns jsonb
language plpgsql set search_path = ''
as $$
declare
  it jsonb;
  v_cat uuid;
  v_id uuid;
  v_ins integer := 0;
  v_upd integer := 0;
begin
  if not public.eh_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  for it in select * from jsonb_array_elements(p_itens) loop
    v_cat := null;
    if nullif(it ->> 'categoria_slug', '') is not null then
      select c.id into v_cat from public.categorias c where c.slug = it ->> 'categoria_slug';
      if v_cat is null then
        insert into public.categorias (nome, slug)
        values (it ->> 'categoria_nome', it ->> 'categoria_slug')
        returning id into v_cat;
      end if;
    end if;

    v_id := null;
    if nullif(it ->> 'id_externo', '') is not null then
      select p.id into v_id from public.produtos p where p.id_externo = it ->> 'id_externo';
    end if;
    if v_id is null then
      select p.id into v_id from public.produtos p where p.link_afiliado = it ->> 'link_afiliado';
    end if;

    if v_id is null then
      insert into public.produtos (
        nome, slug, descricao, imagem_url, categoria_id, preco_atual,
        link_afiliado, id_externo, origem, status_publicacao
      ) values (
        it ->> 'nome', it ->> 'slug', nullif(it ->> 'descricao', ''), nullif(it ->> 'imagem_url', ''),
        v_cat, (it ->> 'preco_atual')::numeric, it ->> 'link_afiliado', nullif(it ->> 'id_externo', ''),
        'csv', coalesce(nullif(it ->> 'status', ''), 'rascunho')::public.status_publicacao
      );
      v_ins := v_ins + 1;
    else
      update public.produtos p set
        nome = it ->> 'nome',
        descricao = coalesce(nullif(it ->> 'descricao', ''), p.descricao),
        imagem_url = coalesce(nullif(it ->> 'imagem_url', ''), p.imagem_url),
        categoria_id = coalesce(v_cat, p.categoria_id),
        preco_atual = (it ->> 'preco_atual')::numeric,
        link_afiliado = it ->> 'link_afiliado',
        id_externo = coalesce(nullif(it ->> 'id_externo', ''), p.id_externo),
        origem_atualizada_em = now()
      where p.id = v_id and not p.ficticio;
      v_upd := v_upd + 1;
    end if;
  end loop;

  insert into public.importacoes (arquivo_nome, total, inseridos, atualizados, rejeitados, erros, criado_por)
  values (
    left(p_arquivo, 200), v_ins + v_upd + coalesce(p_rejeitados, 0), v_ins, v_upd,
    coalesce(p_rejeitados, 0), coalesce(p_erros, '[]'::jsonb), (select auth.uid())
  );

  return jsonb_build_object('inseridos', v_ins, 'atualizados', v_upd);
end;
$$;

-- ---------------------------------------------------------------------------
-- Relatórios do painel (respeitam as políticas de acesso de quem consulta)
-- ---------------------------------------------------------------------------
create function public.produtos_mais_clicados(p_dias integer default 30, p_limite integer default 10)
returns table (produto_id uuid, nome text, slug text, cliques bigint)
language sql stable set search_path = ''
as $$
  select p.id, p.nome, p.slug, count(*) as cliques
  from public.cliques c
  join public.produtos p on p.id = c.produto_id
  where c.criado_em >= now() - make_interval(days => p_dias)
  group by p.id, p.nome, p.slug
  order by cliques desc, p.nome
  limit p_limite;
$$;

create function public.cliques_por_canal(p_dias integer default 30)
returns table (canal text, campanha text, cliques bigint)
language sql stable set search_path = ''
as $$
  select c.canal, coalesce(c.campanha, '') as campanha, count(*) as cliques
  from public.cliques c
  where c.criado_em >= now() - make_interval(days => p_dias)
  group by c.canal, coalesce(c.campanha, '')
  order by cliques desc;
$$;

-- ---------------------------------------------------------------------------
-- Dados de demonstração (sempre marcados como fictícios)
-- ---------------------------------------------------------------------------
create function public.carregar_dados_demo() returns integer
language plpgsql set search_path = ''
as $$
declare
  v_qtd integer;
begin
  if not public.eh_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  insert into public.categorias (nome, slug) values
    ('Eletrônicos', 'eletronicos'),
    ('Casa e Cozinha', 'casa-e-cozinha'),
    ('Beleza', 'beleza')
  on conflict (slug) do nothing;

  insert into public.produtos (nome, slug, descricao, categoria_id, preco_atual, link_afiliado, origem, ficticio, status_publicacao, disponibilidade, destaque)
  select d.nome, d.slug, 'Produto fictício, criado apenas para demonstrar o funcionamento do site. Não está à venda.',
         (select c.id from public.categorias c where c.slug = d.cat), d.preco,
         'https://example.com/demonstracao/' || d.slug, 'demo', true, 'publicado', 'desconhecido', d.destaque
  from (values
    ('Fone Bluetooth (exemplo fictício)', 'demo-fone-bluetooth', 'eletronicos', 199.90, true),
    ('Carregador Turbo 20W (exemplo fictício)', 'demo-carregador-turbo', 'eletronicos', 39.90, false),
    ('Jogo de Panelas 5 Peças (exemplo fictício)', 'demo-jogo-de-panelas', 'casa-e-cozinha', 289.00, true),
    ('Garrafa Térmica 1L (exemplo fictício)', 'demo-garrafa-termica', 'casa-e-cozinha', 74.90, false),
    ('Kit Pincéis de Maquiagem (exemplo fictício)', 'demo-kit-pinceis', 'beleza', 45.50, false),
    ('Secador de Cabelo 2000W (exemplo fictício)', 'demo-secador-de-cabelo', 'beleza', 159.90, false)
  ) as d (nome, slug, cat, preco, destaque)
  on conflict do nothing;
  get diagnostics v_qtd = row_count;

  -- Uma queda de preço de exemplo, para mostrar o "de/por" calculado pelo histórico.
  update public.produtos set preco_atual = 149.90
  where slug = 'demo-fone-bluetooth' and ficticio and preco_atual = 199.90;

  return v_qtd;
end;
$$;

create function public.remover_dados_demo() returns integer
language plpgsql set search_path = ''
as $$
declare
  v_qtd integer;
begin
  if not public.eh_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  delete from public.produtos where ficticio;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

-- ---------------------------------------------------------------------------
-- Segurança: RLS em tudo + permissões explícitas
-- ---------------------------------------------------------------------------
alter table public.administradores enable row level security;
alter table public.categorias enable row level security;
alter table public.produtos enable row level security;
alter table public.historico_precos enable row level security;
alter table public.historico_alteracoes enable row level security;
alter table public.cliques enable row level security;
alter table public.importacoes enable row level security;

create policy "admin ve o proprio registro" on public.administradores
  for select to authenticated using (user_id = (select auth.uid()));

create policy "publico ve categorias ativas" on public.categorias
  for select to anon, authenticated using (ativa or (select public.eh_admin()));
create policy "admin insere categorias" on public.categorias
  for insert to authenticated with check ((select public.eh_admin()));
create policy "admin altera categorias" on public.categorias
  for update to authenticated using ((select public.eh_admin())) with check ((select public.eh_admin()));
create policy "admin exclui categorias" on public.categorias
  for delete to authenticated using ((select public.eh_admin()));

create policy "publico ve produtos publicados" on public.produtos
  for select to anon, authenticated using (status_publicacao = 'publicado' or (select public.eh_admin()));
create policy "admin insere produtos" on public.produtos
  for insert to authenticated with check ((select public.eh_admin()));
create policy "admin altera produtos" on public.produtos
  for update to authenticated using ((select public.eh_admin())) with check ((select public.eh_admin()));
create policy "admin exclui produtos" on public.produtos
  for delete to authenticated using ((select public.eh_admin()));

-- Histórico de preços: visível somente para produtos que a pessoa já pode ver.
create policy "historico de precos segue o produto" on public.historico_precos
  for select to anon, authenticated
  using (exists (select 1 from public.produtos p where p.id = produto_id));

create policy "admin ve alteracoes" on public.historico_alteracoes
  for select to authenticated using ((select public.eh_admin()));
create policy "admin ve cliques" on public.cliques
  for select to authenticated using ((select public.eh_admin()));
create policy "admin ve importacoes" on public.importacoes
  for select to authenticated using ((select public.eh_admin()));
create policy "admin registra importacoes" on public.importacoes
  for insert to authenticated with check ((select public.eh_admin()));

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.categorias, public.produtos, public.historico_precos to anon, authenticated;
grant insert, update, delete on public.categorias, public.produtos to authenticated;
grant select on public.administradores, public.historico_alteracoes, public.cliques, public.importacoes to authenticated;
grant insert on public.importacoes to authenticated;

revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.eh_admin() to anon, authenticated;
grant execute on function public.registrar_clique(uuid, text, text) to anon, authenticated;
grant execute on function public.importar_produtos(jsonb, text, integer, jsonb) to authenticated;
grant execute on function public.produtos_mais_clicados(integer, integer) to authenticated;
grant execute on function public.cliques_por_canal(integer) to authenticated;
grant execute on function public.carregar_dados_demo() to authenticated;
grant execute on function public.remover_dados_demo() to authenticated;
