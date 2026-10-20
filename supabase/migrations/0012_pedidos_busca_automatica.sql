-- Busca automática de opções ao receber o pedido ("Pede pra Moni"). Fica DESLIGADA até a administradora ligar no painel.
-- Quando ligada, o servidor do site procura na Shopee logo depois que o visitante envia o pedido e mostra, na tela de
-- confirmação, o link da página do pedido (/pedido/<código secreto>) com as opções.

alter table public.config_servidor
  add column pedidos_auto boolean not null default false;

-- Painel (administradora): liga ou desliga.
create function public.definir_pedidos_auto(p_ligado boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.eh_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_ligado is null then
    raise exception 'Valor inválido' using errcode = '22023';
  end if;
  update public.config_servidor set pedidos_auto = p_ligado, atualizado_em = now() where id = 1;
  return p_ligado;
end;
$$;
revoke all on function public.definir_pedidos_auto(boolean) from public, anon, authenticated;
grant execute on function public.definir_pedidos_auto(boolean) to authenticated;

-- O interruptor em si (o painel mostra; não é dado sensível).
create function public.pedidos_auto_ligado()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select c.pedidos_auto from public.config_servidor c where c.id = 1), false);
$$;
revoke all on function public.pedidos_auto_ligado() from public, anon, authenticated;
grant execute on function public.pedidos_auto_ligado() to anon, authenticated;

-- O servidor pergunta antes de buscar: ligado E abaixo do teto de 30 buscas por hora (cada busca gasta ~10 chamadas da
-- cota da Shopee, que o site também usa para importar e conferir preços; o teto protege essa cota de abuso).
-- Passado o teto, o pedido segue normal, sem busca automática.
create function public.pedidos_auto_disponivel()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.pedidos_auto_ligado()
     and (select count(*) from public.pedidos p where p.buscado_em > now() - interval '1 hour') < 30;
$$;
revoke all on function public.pedidos_auto_disponivel() from public, anon, authenticated;
grant execute on function public.pedidos_auto_disponivel() to anon, authenticated;

-- Código secreto de um pedido recém-criado, para a tela de confirmação. Só o servidor (com a chave da automação) chama,
-- e só vale na primeira hora do pedido: o código nunca sai do banco por outro caminho que não seja a página do pedido.
create function public.pedido_token(p_chave text, p_pedido uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text;
begin
  if not public.automacao_chave_ok(p_chave) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select p.token into v_token from public.pedidos p where p.id = p_pedido and p.criado_em > now() - interval '1 hour';
  return v_token;
end;
$$;
revoke all on function public.pedido_token(text, uuid) from public, anon, authenticated;
grant execute on function public.pedido_token(text, uuid) to anon, authenticated;
