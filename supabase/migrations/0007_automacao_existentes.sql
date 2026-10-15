-- Automação: informa quais produtos candidatos já existem no site (pelo id da Shopee), para a rotina não
-- gastar a cota diária com repetidos. Só devolve os ids que a própria rotina perguntou, e só com a chave certa.
create function public.automacao_existentes(p_chave text, p_ids text[])
returns text[]
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.automacao_chave_ok(p_chave) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    return '{}'::text[];
  end if;
  if cardinality(p_ids) > 1000 then
    raise exception 'Itens demais' using errcode = '22023';
  end if;
  return coalesce((select array_agg(p.id_externo) from public.produtos p where p.id_externo = any (p_ids)), '{}'::text[]);
end;
$$;
revoke all on function public.automacao_existentes(text, text[]) from public, anon, authenticated;
grant execute on function public.automacao_existentes(text, text[]) to anon, authenticated;
