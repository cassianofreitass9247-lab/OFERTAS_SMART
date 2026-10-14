-- Vitrine da Moni — migração 0004: proteção contra abuso (pedidos e cliques)
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Execute uma única vez, depois da 0003. Não apaga dados.
--
-- 1. Pedidos: a função criar_pedido passa a exigir
--    a) o consentimento do visitante (antes só era conferido no site) e
--    b) uma chave que só o servidor do site conhece, para que robôs não chamem a função direto
--       pela API pública do Supabase, pulando o "não sou robô" (Turnstile) do formulário.
--    O banco guarda só o hash (SHA-256) da chave. O painel registra o hash sozinho na primeira vez
--    que a administradora abre o painel depois de configurar o Turnstile no Cloudflare.
--    Enquanto nenhuma chave estiver registrada, a função aceita pedidos sem chave (como antes).
-- 2. Cliques: teto por produto e por hora, para que cliques falsos em massa não distorçam as
--    estatísticas nem encham o banco; cliques com mais de 12 meses são apagados.

-- ---------------------------------------------------------------------------
-- Configuração privada do servidor (ninguém lê pela API; só funções do banco)
-- ---------------------------------------------------------------------------
create table public.config_servidor (
  id smallint primary key default 1 check (id = 1),
  chave_pedidos_hash text check (chave_pedidos_hash ~ '^[0-9a-f]{64}$'),
  atualizado_em timestamptz not null default now()
);
alter table public.config_servidor enable row level security;
revoke all on public.config_servidor from public, anon, authenticated;
insert into public.config_servidor (id) values (1);

-- Chamada pelo painel (só administradora). p_hash nulo desliga a exigência da chave.
create function public.sincronizar_chave_servidor(p_hash text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.eh_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_hash is not null and p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Hash inválido' using errcode = '22023';
  end if;
  update public.config_servidor
     set chave_pedidos_hash = p_hash, atualizado_em = now()
   where id = 1 and chave_pedidos_hash is distinct from p_hash;
  return found;
end;
$$;
revoke all on function public.sincronizar_chave_servidor(text) from public, anon, authenticated;
grant execute on function public.sincronizar_chave_servidor(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
alter table public.pedidos add column consentimento_em timestamptz;

drop function public.criar_pedido(text, text, text, text);

create function public.criar_pedido(
  p_nome text,
  p_whatsapp text,
  p_descricao text,
  p_referencia text default null,
  p_consentimento boolean default false,
  p_chave text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_whats text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_desc text := btrim(coalesce(p_descricao, ''));
  v_ref text := nullif(btrim(coalesce(p_referencia, '')), '');
  v_hash text;
  v_id uuid;
begin
  -- Só o servidor do site conhece a chave (derivada do segredo do Turnstile).
  select c.chave_pedidos_hash into v_hash from public.config_servidor c where c.id = 1;
  if v_hash is not null
     and (p_chave is null or encode(sha256(convert_to(p_chave, 'UTF8')), 'hex') <> v_hash) then
    raise exception 'Pedido recusado' using errcode = '42501', hint = 'chave';
  end if;

  if not coalesce(p_consentimento, false) then
    raise exception 'Marque a autorização para a Moni chamar você no WhatsApp' using errcode = '22023';
  end if;

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

  -- Limites contra abuso: 3 pedidos por número em 24 h e 200 pedidos por hora no total.
  -- (O teto geral subiu de 60 para 200: com o Turnstile, ele é só uma rede de segurança e
  -- não deve bloquear clientes reais.)
  if (select count(*) from public.pedidos where whatsapp = v_whats and criado_em > now() - interval '24 hours') >= 3 then
    raise exception 'Limite de pedidos para este número atingido' using errcode = 'P0001', hint = 'limite_numero';
  end if;
  if (select count(*) from public.pedidos where criado_em > now() - interval '1 hour') >= 200 then
    raise exception 'Muitos pedidos no momento' using errcode = 'P0001', hint = 'limite_geral';
  end if;

  insert into public.pedidos (nome, whatsapp, descricao, referencia_url, consentimento_em)
  values (v_nome, v_whats, v_desc, v_ref, now())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.criar_pedido(text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.criar_pedido(text, text, text, text, boolean, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cliques: teto contra cliques falsos em massa + retenção de 12 meses
-- A pessoa é sempre levada à Shopee; acima do teto, o clique só deixa de ser contado.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_clique(p_produto uuid, p_canal text default 'site', p_campanha text default null)
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

  -- Até 20 cliques por produto por minuto e 3.000 cliques por hora no site todo.
  if (select count(*) from public.cliques c where c.produto_id = p_produto and c.criado_em > now() - interval '1 minute') >= 20
     or (select count(*) from public.cliques c where c.criado_em > now() - interval '1 hour') >= 3000 then
    return v_link;
  end if;

  insert into public.cliques (produto_id, canal, campanha)
  values (
    p_produto,
    left(coalesce(nullif(btrim(p_canal), ''), 'site'), 40),
    left(nullif(btrim(p_campanha), ''), 80)
  );

  -- Limpeza ocasional (em ~1% dos cliques), para não pesar em cada clique.
  if random() < 0.01 then
    delete from public.cliques where criado_em < now() - interval '12 months';
  end if;

  return v_link;
end;
$$;
