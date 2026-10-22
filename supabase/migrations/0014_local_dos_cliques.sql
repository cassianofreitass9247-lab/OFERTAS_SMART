-- Vitrine da Moni — migração 0014: local aproximado dos cliques (país, estado e cidade)
-- O local vem da Cloudflare (estimativa pelo IP). O IP em si NUNCA é guardado.
-- Cliques antigos ficam sem local; só os novos passam a ter. Os valores são validados aqui, porque a
-- função é chamável por qualquer visitante.

alter table public.cliques
  add column pais text,
  add column estado text,
  add column cidade text;

drop function public.registrar_clique(uuid, text, text);

create function public.registrar_clique(
  p_produto uuid,
  p_canal text default 'site',
  p_campanha text default null,
  p_pais text default null,
  p_estado text default null,
  p_cidade text default null
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_link text;
  v_pais text := upper(btrim(p_pais));
  v_estado text := upper(btrim(p_estado));
  v_cidade text := nullif(left(btrim(regexp_replace(coalesce(p_cidade, ''), '[[:cntrl:]]', '', 'g')), 80), '');
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

  -- Local fora do formato vira "sem local" (país: 2 letras; estado: até 3 letras ou números).
  if v_pais is null or v_pais !~ '^[A-Z]{2}$' then
    v_pais := null; v_estado := null; v_cidade := null;
  end if;
  if v_estado is not null and v_estado !~ '^[A-Z0-9]{1,3}$' then
    v_estado := null;
  end if;

  insert into public.cliques (produto_id, canal, campanha, pais, estado, cidade)
  values (
    p_produto,
    left(coalesce(nullif(btrim(p_canal), ''), 'site'), 40),
    left(nullif(btrim(p_campanha), ''), 80),
    v_pais, v_estado, v_cidade
  );

  -- Limpeza ocasional (em ~1% dos cliques), para não pesar em cada clique.
  if random() < 0.01 then
    delete from public.cliques where criado_em < now() - interval '12 months';
  end if;

  return v_link;
end;
$$;

revoke all on function public.registrar_clique(uuid, text, text, text, text, text) from public;
grant execute on function public.registrar_clique(uuid, text, text, text, text, text) to anon, authenticated;

-- Cliques por local, no mesmo período (dias de calendário em Mossoró) do resumo. Só leitura; quem não é
-- administrador recebe zeros. Devolve até 10 estados e 10 cidades.
create function public.cliques_locais(p_dias integer default 30)
returns jsonb
language sql stable set search_path = ''
as $$
  with p as (
    select greatest(1, least(coalesce(p_dias, 30), 365)) as d
  ),
  janela as (
    select ((date_trunc('day', now() at time zone 'America/Fortaleza') - make_interval(days => p.d - 1)) at time zone 'America/Fortaleza') as ini
    from p
  ),
  atual as (
    select c.pais, c.estado, c.cidade
    from public.cliques c, janela j
    where c.criado_em >= j.ini
  )
  select jsonb_build_object(
    'total', (select count(*) from atual),
    'com_local', (select count(*) from atual where pais is not null),
    'por_estado', coalesce((
      select jsonb_agg(jsonb_build_object('pais', x.pais, 'estado', x.estado, 'cliques', x.n) order by x.n desc, x.pais, x.estado)
      from (select pais, estado, count(*) as n from atual where pais is not null group by 1, 2 order by n desc, pais, estado limit 10) x
    ), '[]'::jsonb),
    'por_cidade', coalesce((
      select jsonb_agg(jsonb_build_object('pais', x.pais, 'estado', x.estado, 'cidade', x.cidade, 'cliques', x.n) order by x.n desc, x.cidade)
      from (select pais, estado, cidade, count(*) as n from atual where cidade is not null group by 1, 2, 3 order by n desc, cidade limit 10) x
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.cliques_locais(integer) to authenticated;
