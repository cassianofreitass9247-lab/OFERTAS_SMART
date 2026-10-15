-- Sincronização de preços: a rotina agendada (de hora em hora) confere na Shopee o preço dos produtos publicados e
-- grava o novo preço. A queda vira "Preço caiu" sozinha, pelo gatilho que já existe (produtos_antes_de_gravar).
alter table public.produtos add column preco_verificado_em timestamptz;
create index produtos_preco_verificado_idx on public.produtos (preco_verificado_em nulls first)
  where status_publicacao = 'publicado' and id_externo is not null;

alter table public.automacao_config
  add column precos_ativo boolean not null default true,
  add column precos_ultima_execucao timestamptz,
  add column precos_ultimo_resultado text;

-- Próximos produtos a conferir: os publicados com id da Shopee, do verificado há mais tempo (ou nunca) para o mais recente.
create function public.precos_pendentes(p_chave text, p_limite integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  c public.automacao_config;
begin
  if not public.automacao_chave_ok(p_chave) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select * into c from public.automacao_config where id = 1;
  if not c.precos_ativo then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id_externo', t.id_externo, 'preco_atual', t.preco_atual))
    from (
      select p.id_externo, p.preco_atual
      from public.produtos p
      where p.status_publicacao = 'publicado'
        and p.id_externo ~ '^[0-9]{1,19}\.[0-9]{1,19}$'
        and p.origem <> 'demo'
      order by p.preco_verificado_em nulls first, p.criado_em
      limit greatest(least(coalesce(p_limite, 30), 100), 1)
    ) t
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.precos_pendentes(text, integer) from public, anon, authenticated;
grant execute on function public.precos_pendentes(text, integer) to anon, authenticated;

-- Grava o resultado da conferência. Cada item: { id_externo, preco } (preco nulo = a Shopee não devolveu o produto).
-- Só muda o preço quando a diferença é de 1% ou mais (ruído de centavos não vira "queda") e ignora quedas acima de 60%
-- (provável variação mais barata do anúncio, não promoção). Marca todos como verificados, para o rodízio andar.
create function public.precos_aplicar(p_chave text, p_itens jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  it jsonb;
  v_ext text;
  v_preco numeric;
  v_atual numeric;
  v_conferidos integer := 0;
  v_quedas integer := 0;
  v_altas integer := 0;
  v_suspeitos integer := 0;
  v_ausentes integer := 0;
  v_texto text;
begin
  if not public.automacao_chave_ok(p_chave) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) <> 'array' then
    raise exception 'Itens inválidos' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) > 100 then
    raise exception 'Itens demais' using errcode = '22023';
  end if;

  for it in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    begin
      v_ext := btrim(it ->> 'id_externo');
      v_preco := nullif(it ->> 'preco', '')::numeric;
      if v_ext is null or v_ext !~ '^[0-9]{1,19}\.[0-9]{1,19}$' then
        continue;
      end if;
      v_conferidos := v_conferidos + 1;
      if v_preco is null or v_preco <= 0 then
        v_ausentes := v_ausentes + 1;
        update public.produtos set preco_verificado_em = now() where id_externo = v_ext and status_publicacao = 'publicado';
        continue;
      end if;
      for v_atual in select preco_atual from public.produtos where id_externo = v_ext and status_publicacao = 'publicado' loop
        if abs(v_preco - v_atual) / v_atual < 0.01 then
          null; -- diferença pequena: mantém
        elsif v_preco < v_atual * 0.4 then
          v_suspeitos := v_suspeitos + 1;
        else
          if v_preco < v_atual then v_quedas := v_quedas + 1; else v_altas := v_altas + 1; end if;
          update public.produtos set preco_atual = v_preco where id_externo = v_ext and status_publicacao = 'publicado' and preco_atual = v_atual;
        end if;
      end loop;
      update public.produtos set preco_verificado_em = now() where id_externo = v_ext and status_publicacao = 'publicado';
    exception when others then
      null;
    end;
  end loop;

  v_texto := v_conferidos || ' conferido(s): ' || v_quedas || ' queda(s), ' || v_altas || ' alta(s)'
          || case when v_suspeitos > 0 then ', ' || v_suspeitos || ' queda(s) suspeita(s) ignorada(s)' else '' end
          || case when v_ausentes > 0 then ', ' || v_ausentes || ' sem resposta da Shopee' else '' end || '.';
  update public.automacao_config
     set precos_ultima_execucao = now(), precos_ultimo_resultado = v_texto, atualizado_em = now()
   where id = 1;
  return jsonb_build_object('conferidos', v_conferidos, 'quedas', v_quedas, 'altas', v_altas, 'suspeitos', v_suspeitos, 'ausentes', v_ausentes);
end;
$$;
revoke all on function public.precos_aplicar(text, jsonb) from public, anon, authenticated;
grant execute on function public.precos_aplicar(text, jsonb) to anon, authenticated;

-- Registra falha da conferência (Shopee fora do ar etc.) sem mexer na pausa da automação.
create function public.precos_falha(p_chave text, p_msg text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.automacao_chave_ok(p_chave) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.automacao_config
     set precos_ultima_execucao = now(), precos_ultimo_resultado = 'Falha: ' || left(coalesce(p_msg, 'erro'), 200), atualizado_em = now()
   where id = 1;
end;
$$;
revoke all on function public.precos_falha(text, text) from public, anon, authenticated;
grant execute on function public.precos_falha(text, text) to anon, authenticated;
