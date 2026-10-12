-- Vitrine da Moni — migração 0002: pedidos de produto ("Pede pra Moni") e vídeo do produto
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Execute uma única vez, depois da 0001. Não apaga nem altera dados existentes.

-- ---------------------------------------------------------------------------
-- Vídeo do produto (YouTube, TikTok, Instagram, Shopee Video ou arquivo .mp4)
-- A lista de sites aceitos é conferida no aplicativo; aqui só garantimos https.
-- ---------------------------------------------------------------------------
alter table public.produtos
  add column video_url text check (video_url ~ '^https://' and char_length(video_url) <= 2000);

-- ---------------------------------------------------------------------------
-- Pedidos de produto feitos por visitantes
-- Dado pessoal (nome + WhatsApp): só o administrador lê. O visitante não grava
-- direto na tabela; passa pela função criar_pedido, que valida e limita volume.
-- ---------------------------------------------------------------------------
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 60),
  -- Somente dígitos, com DDI 55: 55 + DDD + número (12 ou 13 dígitos).
  whatsapp text not null check (whatsapp ~ '^55[1-9][0-9]{9,10}$'),
  descricao text not null check (char_length(descricao) between 3 and 500),
  referencia_url text check (referencia_url ~ '^https://' and char_length(referencia_url) <= 2000),
  status text not null default 'novo' check (status in ('novo', 'respondido', 'arquivado')),
  produto_id uuid references public.produtos (id) on delete set null,
  link_enviado text check (char_length(link_enviado) <= 2000),
  respondido_em timestamptz,
  criado_em timestamptz not null default now()
);
create index pedidos_status_idx on public.pedidos (status, criado_em desc);
create index pedidos_whatsapp_idx on public.pedidos (whatsapp, criado_em desc);

create function public.criar_pedido(
  p_nome text,
  p_whatsapp text,
  p_descricao text,
  p_referencia text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_whats text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_desc text := btrim(coalesce(p_descricao, ''));
  v_ref text := nullif(btrim(coalesce(p_referencia, '')), '');
  v_id uuid;
begin
  -- Aceita o número com ou sem o 55 na frente.
  if v_whats !~ '^55' or char_length(v_whats) < 12 then
    v_whats := '55' || v_whats;
  end if;

  if char_length(v_nome) not between 2 and 60 then
    raise exception 'Nome: use de 2 a 60 caracteres' using errcode = '22023';
  end if;
  if v_whats !~ '^55[1-9][0-9]{9,10}$' then
    raise exception 'WhatsApp inválido' using errcode = '22023';
  end if;
  if char_length(v_desc) not between 3 and 500 then
    raise exception 'Descrição: use de 3 a 500 caracteres' using errcode = '22023';
  end if;
  if v_ref is not null and (v_ref !~ '^https://' or char_length(v_ref) > 2000) then
    raise exception 'Link de referência inválido' using errcode = '22023';
  end if;

  -- Retenção: pedidos com mais de 90 dias são apagados automaticamente.
  delete from public.pedidos where criado_em < now() - interval '90 days';

  -- Limites contra abuso: 3 pedidos por número em 24 h e 60 pedidos por hora no total.
  if (select count(*) from public.pedidos where whatsapp = v_whats and criado_em > now() - interval '24 hours') >= 3 then
    raise exception 'Limite de pedidos para este número atingido' using errcode = 'P0001', hint = 'limite_numero';
  end if;
  if (select count(*) from public.pedidos where criado_em > now() - interval '1 hour') >= 60 then
    raise exception 'Muitos pedidos no momento' using errcode = 'P0001', hint = 'limite_geral';
  end if;

  insert into public.pedidos (nome, whatsapp, descricao, referencia_url)
  values (v_nome, v_whats, v_desc, v_ref)
  returning id into v_id;
  return v_id;
end;
$$;

alter table public.pedidos enable row level security;
create policy "admin ve pedidos" on public.pedidos
  for select to authenticated using ((select public.eh_admin()));
create policy "admin altera pedidos" on public.pedidos
  for update to authenticated using ((select public.eh_admin())) with check ((select public.eh_admin()));
create policy "admin exclui pedidos" on public.pedidos
  for delete to authenticated using ((select public.eh_admin()));

revoke all on public.pedidos from anon, authenticated;
grant select, update, delete on public.pedidos to authenticated;

revoke all on function public.criar_pedido(text, text, text, text) from public, anon, authenticated;
grant execute on function public.criar_pedido(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Importação por CSV passa a aceitar a coluna de vídeo
-- ---------------------------------------------------------------------------
create or replace function public.importar_produtos(
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
        nome, slug, descricao, imagem_url, video_url, categoria_id, preco_atual,
        link_afiliado, id_externo, origem, status_publicacao
      ) values (
        it ->> 'nome', it ->> 'slug', nullif(it ->> 'descricao', ''), nullif(it ->> 'imagem_url', ''),
        nullif(it ->> 'video_url', ''),
        v_cat, (it ->> 'preco_atual')::numeric, it ->> 'link_afiliado', nullif(it ->> 'id_externo', ''),
        'csv', coalesce(nullif(it ->> 'status', ''), 'rascunho')::public.status_publicacao
      );
      v_ins := v_ins + 1;
    else
      update public.produtos p set
        nome = it ->> 'nome',
        descricao = coalesce(nullif(it ->> 'descricao', ''), p.descricao),
        imagem_url = coalesce(nullif(it ->> 'imagem_url', ''), p.imagem_url),
        video_url = coalesce(nullif(it ->> 'video_url', ''), p.video_url),
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
