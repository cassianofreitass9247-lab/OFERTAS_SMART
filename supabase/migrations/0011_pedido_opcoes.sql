-- Opções de produto por pedido ("Pede pra Moni"): o servidor busca na Shopee 3 a 5 produtos variados para cada pedido,
-- gera um link de afiliado de cada um (com o identificador do pedido, para a comissão ser atribuída por pedido) e a
-- cliente escolhe numa página só dela, aberta por um código secreto na URL.

-- Código secreto da página do pedido (122 bits aleatórios). Quem não tem o código não consegue abrir a página.
alter table public.pedidos
  add column token text not null default replace(gen_random_uuid()::text, '-', '') check (token ~ '^[0-9a-f]{32}$'),
  add column busca_termo text check (char_length(busca_termo) <= 200),
  add column buscado_em timestamptz,
  add column busca_resultado text check (char_length(busca_resultado) <= 300);
create unique index pedidos_token_idx on public.pedidos (token);

create table public.pedido_opcoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  posicao smallint not null check (posicao between 1 and 5),
  rotulo text not null check (char_length(rotulo) between 2 and 60),
  nome text not null check (char_length(nome) between 2 and 300),
  imagem_url text check (imagem_url ~ '^https://' and char_length(imagem_url) <= 2000),
  preco numeric(12, 2) check (preco > 0),
  nota numeric(3, 2) check (nota between 0 and 5),
  vendas integer check (vendas >= 0),
  loja text check (char_length(loja) <= 120),
  -- Só links da Shopee (a mesma regra dos produtos, aqui também no banco).
  link_afiliado text not null check (link_afiliado ~* '^https://([a-z0-9-]+\.)*(shopee\.com\.br|shope\.ee)(/|\?|$)' and char_length(link_afiliado) <= 2000),
  id_externo text check (id_externo ~ '^[0-9]{1,19}\.[0-9]{1,19}$'),
  cliques integer not null default 0 check (cliques >= 0),
  criado_em timestamptz not null default now(),
  unique (pedido_id, posicao)
);
create index pedido_opcoes_pedido_idx on public.pedido_opcoes (pedido_id, posicao);

-- A tabela é lida só pela administradora; o público passa pelas funções abaixo. Escrita só pela função com chave.
alter table public.pedido_opcoes enable row level security;
create policy "admin ve opcoes de pedido" on public.pedido_opcoes
  for select to authenticated using ((select public.eh_admin()));
create policy "admin exclui opcoes de pedido" on public.pedido_opcoes
  for delete to authenticated using ((select public.eh_admin()));
revoke all on public.pedido_opcoes from anon, authenticated;
grant select, delete on public.pedido_opcoes to authenticated;

-- Grava as opções de um pedido (substitui as anteriores). Chamada só pelo servidor, com a chave da automação:
-- o mesmo padrão das demais rotinas automáticas (a aplicação não usa a chave service_role).
-- p_opcoes: lista de até 5 objetos { rotulo, nome, imagem_url, preco, nota, vendas, loja, link_afiliado, id_externo }.
create function public.pedido_gravar_opcoes(p_chave text, p_pedido uuid, p_termo text, p_resultado text, p_opcoes jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  it jsonb;
  v_pos smallint := 0;
begin
  if not public.automacao_chave_ok(p_chave) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_opcoes, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_opcoes, '[]'::jsonb)) > 5 then
    raise exception 'Opções inválidas' using errcode = '22023';
  end if;
  perform 1 from public.pedidos where id = p_pedido for update;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = '22023';
  end if;

  delete from public.pedido_opcoes where pedido_id = p_pedido;
  for it in select * from jsonb_array_elements(coalesce(p_opcoes, '[]'::jsonb)) loop
    v_pos := v_pos + 1;
    insert into public.pedido_opcoes (pedido_id, posicao, rotulo, nome, imagem_url, preco, nota, vendas, loja, link_afiliado, id_externo)
    values (
      p_pedido, v_pos,
      left(btrim(it ->> 'rotulo'), 60),
      left(btrim(it ->> 'nome'), 300),
      nullif(it ->> 'imagem_url', ''),
      nullif(it ->> 'preco', '')::numeric,
      nullif(it ->> 'nota', '')::numeric,
      nullif(it ->> 'vendas', '')::numeric::integer,
      left(nullif(btrim(it ->> 'loja'), ''), 120),
      it ->> 'link_afiliado',
      nullif(it ->> 'id_externo', '')
    );
  end loop;

  update public.pedidos
     set busca_termo = left(nullif(btrim(p_termo), ''), 200),
         buscado_em = now(),
         busca_resultado = left(nullif(btrim(p_resultado), ''), 300)
   where id = p_pedido;
  return v_pos;
end;
$$;
revoke all on function public.pedido_gravar_opcoes(text, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.pedido_gravar_opcoes(text, uuid, text, text, jsonb) to anon, authenticated;

-- Página da cliente: devolve só o primeiro nome, o pedido e as opções (sem WhatsApp, sem sobrenome, sem os links:
-- o clique passa por registrar_clique_opcao). Código inexistente devolve nulo.
create function public.pedido_publico(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  p public.pedidos;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;
  select * into p from public.pedidos where token = p_token;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'nome', split_part(p.nome, ' ', 1),
    'descricao', p.descricao,
    'criado_em', p.criado_em,
    'opcoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'rotulo', o.rotulo, 'nome', o.nome, 'imagem_url', o.imagem_url,
        'preco', o.preco, 'nota', o.nota, 'vendas', o.vendas, 'loja', o.loja) order by o.posicao)
      from public.pedido_opcoes o where o.pedido_id = p.id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.pedido_publico(text) from public, anon, authenticated;
grant execute on function public.pedido_publico(text) to anon, authenticated;

-- Conta o clique numa opção (sem dados pessoais) e devolve o link de afiliado dela.
create function public.registrar_clique_opcao(p_opcao uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_link text;
begin
  update public.pedido_opcoes o
     set cliques = least(o.cliques + 1, 2000000000)
   where o.id = p_opcao
  returning o.link_afiliado into v_link;
  return v_link;
end;
$$;
revoke all on function public.registrar_clique_opcao(uuid) from public, anon, authenticated;
grant execute on function public.registrar_clique_opcao(uuid) to anon, authenticated;
