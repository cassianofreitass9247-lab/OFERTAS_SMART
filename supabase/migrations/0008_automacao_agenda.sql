-- Agenda da automação: dias da semana e hora (horário de Brasília) escolhidos no painel.
-- O Cloudflare passa a acordar de hora em hora; quem decide se roda é o banco (automacao_reivindicar), uma vez por dia.
alter table public.automacao_config
  add column dias_semana smallint[] not null default '{0,1,2,3,4,5,6}',
  add column hora_execucao smallint not null default 9,
  add column ultima_agendada date,
  add constraint automacao_dias_validos check (cardinality(dias_semana) between 1 and 7 and dias_semana <@ array[0,1,2,3,4,5,6]::smallint[]),
  add constraint automacao_hora_valida check (hora_execucao between 0 and 23);

comment on column public.automacao_config.dias_semana is 'Dias em que a execução agendada roda: 0 = domingo ... 6 = sábado (fuso de Brasília).';
comment on column public.automacao_config.hora_execucao is 'Hora cheia (0-23, horário de Brasília) a partir da qual a execução agendada do dia pode rodar.';
comment on column public.automacao_config.ultima_agendada is 'Dia (Brasília) em que a execução agendada já foi iniciada; evita rodar duas vezes no mesmo dia.';

-- Quem já rodou hoje de manhã (9h, agendamento antigo) não roda de novo ao aplicar esta migração.
update public.automacao_config
   set ultima_agendada = (ultima_execucao at time zone 'America/Sao_Paulo')::date
 where ultima_execucao is not null;

-- Chamada pelo agendamento (de hora em hora). Devolve true UMA vez por dia: quando está ligada, hoje é um dos dias
-- escolhidos, a hora escolhida já chegou e hoje ainda não rodou. Se o Cloudflare perder um disparo, o seguinte recupera.
create function public.automacao_reivindicar(p_chave text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_ok boolean;
begin
  if not public.automacao_chave_ok(p_chave) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.automacao_config
     set ultima_agendada = v_agora::date
   where id = 1
     and ativo
     and extract(dow from v_agora)::smallint = any (dias_semana)
     and extract(hour from v_agora)::smallint >= hora_execucao
     and ultima_agendada is distinct from v_agora::date
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;
revoke all on function public.automacao_reivindicar(text) from public, anon, authenticated;
grant execute on function public.automacao_reivindicar(text) to anon, authenticated;
