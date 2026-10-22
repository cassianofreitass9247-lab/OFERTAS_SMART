-- Vitrine da Moni — migração 0013: números do Resumo do painel (cliques por dia, dia da semana e horário)
-- Só leitura. Respeita as políticas de acesso de quem consulta: quem não é administrador recebe zeros.
-- Os dias são contados no horário de Mossoró (America/Fortaleza). O período termina hoje e começa
-- (p_dias - 1) dias atrás, então "7 dias" são 7 dias de calendário, contando o de hoje.

create function public.cliques_resumo(p_dias integer default 30)
returns jsonb
language sql stable set search_path = ''
as $$
  with p as (
    select greatest(1, least(coalesce(p_dias, 30), 365)) as d
  ),
  janela as (
    select
      ((date_trunc('day', now() at time zone 'America/Fortaleza') - make_interval(days => p.d - 1)) at time zone 'America/Fortaleza') as ini,
      p.d
    from p
  ),
  atual as (
    select (c.criado_em at time zone 'America/Fortaleza') as local
    from public.cliques c, janela j
    where c.criado_em >= j.ini
  )
  select jsonb_build_object(
    'dias', (select d from janela),
    'total', (select count(*) from atual),
    'anterior', (
      select count(*) from public.cliques c, janela j
      where c.criado_em >= j.ini - make_interval(days => j.d) and c.criado_em < j.ini
    ),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', x.dia, 'cliques', x.n) order by x.dia)
      from (select local::date as dia, count(*) as n from atual group by 1) x
    ), '[]'::jsonb),
    'por_dia_semana', coalesce((
      select jsonb_agg(jsonb_build_object('dia', x.dow, 'cliques', x.n) order by x.dow)
      from (select extract(dow from local)::int as dow, count(*) as n from atual group by 1) x
    ), '[]'::jsonb),
    'por_hora', coalesce((
      select jsonb_agg(jsonb_build_object('hora', x.h, 'cliques', x.n) order by x.h)
      from (select extract(hour from local)::int as h, count(*) as n from atual group by 1) x
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.cliques_resumo(integer) to authenticated;
