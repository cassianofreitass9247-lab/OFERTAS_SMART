-- Vitrine da Moni — migração 0006: modo automático de importação da Shopee
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Execute uma única vez, depois da 0005. Não apaga nem altera dados existentes.
--
-- O agendamento do Cloudflare roda a importação sozinho. Ele NÃO usa conta de administradora nem chave mestra:
-- chama funções do banco (abaixo) com uma chave derivada do segredo da Shopee, que só o servidor conhece.
-- O banco guarda só o hash da chave (o painel registra sozinho quando a administradora o abre).
-- As funções recusam tudo sem a chave, exigem a automação ligada e impõem o limite diário.

create table public.automacao_config (
  id smallint primary key default 1 check (id = 1),
  ativo boolean not null default false,
  limite_diario integer not null default 30 check (limite_diario between 1 and 60),
  vendas_min integer not null default 100 check (vendas_min >= 0),
  nota_min numeric(3, 1) not null default 4.5 check (nota_min between 0 and 5),
  desconto_min integer not null default 20 check (desconto_min between 0 and 100),
  comissao_min numeric(5, 2) not null default 0 check (comissao_min between 0 and 100),
  cursor_categoria integer not null default 0 check (cursor_categoria >= 0),
  erros_seguidos integer not null default 0,
  pausado_motivo text,
  ultima_execucao timestamptz,
  ultimo_resultado text,
  atualizado_em timestamptz not null default now()
);
insert into public.automacao_config (id) values (1);

alter table public.automacao_config enable row level security;
revoke all on public.automacao_config from public, anon, authenticated;
grant select, update on public.automacao_config to authenticated;
create policy "admin ve automacao" on public.automacao_config
  for select to authenticated using ((select public.eh_admin()));
create policy "admin altera automacao" on public.automacao_config
  for update to authenticated using ((select public.eh_admin())) with check ((select public.eh_admin()));

alter table public.lotes_importacao add column automatico boolean not null default false;

alter table public.config_servidor
  add column chave_automacao_hash text check (chave_automacao_hash ~ '^[0-9a-f]{64}$');

-- Painel (administradora): registra o hash da chave da automação. Nulo desliga o recurso.
create function public.sincronizar_chave_automacao(p_hash text)
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
  update public.config_servidor set chave_automacao_hash = p_hash, atualizado_em = now()
   where id = 1 and chave_automacao_hash is distinct from p_hash;
  return found;
end;
$$;
revoke all on function public.sincronizar_chave_automacao(text) from public, anon, authenticated;
grant execute on function public.sincronizar_chave_automacao(text) to authenticated;

-- Interna: confere a chave. Sem hash registrado, nada passa.
create function public.automacao_chave_ok(p_chave text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select c.chave_automacao_hash is not null
        and p_chave is not null
        and encode(sha256(convert_to(p_chave, 'UTF8')), 'hex') = c.chave_automacao_hash
       from public.config_servidor c where c.id = 1),
    false);
$$;
revoke all on function public.automacao_chave_ok(text) from public, anon, authenticated;

-- Quantos produtos as execuções automáticas já criaram hoje (dia de Brasília).
-- Soma os lotes, então desfazer um lote não libera cota para o mesmo dia.
create function public.automacao_criados_hoje()
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(l.total), 0)::integer
    from public.lotes_importacao l
   where l.automatico
     and (l.criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date;
$$;
revoke all on function public.automacao_criados_hoje() from public, anon, authenticated;
grant execute on function public.automacao_criados_hoje() to authenticated; -- painel mostra o número

-- Estado para a rotina agendada.
create function public.automacao_estado(p_chave text)
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
  return jsonb_build_object(
    'ativo', c.ativo,
    'limite_diario', c.limite_diario,
    'criados_hoje', public.automacao_criados_hoje(),
    'vendas_min', c.vendas_min,
    'nota_min', c.nota_min,
    'desconto_min', c.desconto_min,
    'comissao_min', c.comissao_min,
    'cursor', c.cursor_categoria,
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'nome', k.nome, 'slug', k.slug) order by k.nome)
                              from public.categorias k where k.ativa), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.automacao_estado(text) from public, anon, authenticated;
grant execute on function public.automacao_estado(text) to anon, authenticated;

-- Grava os produtos escolhidos pela rotina (publicados e disponíveis) em um lote automático.
-- Valida tudo de novo, aplica o limite diário e ignora duplicados.
create function public.automacao_registrar(p_chave text, p_itens jsonb, p_filtros jsonb, p_cursor integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  c public.automacao_config;
  v_restante integer;
  v_lote uuid;
  v_criados integer := 0;
  v_ignorados integer := 0;
  it jsonb;
  v_nome text;
  v_link text;
  v_img text;
  v_ext text;
  v_slug text;
  v_preco numeric;
  v_cat uuid;
begin
  if not public.automacao_chave_ok(p_chave) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select * into c from public.automacao_config where id = 1 for update;
  if not c.ativo then
    raise exception 'Automação pausada' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) <> 'array' then
    raise exception 'Itens inválidos' using errcode = '22023';
  end if;

  v_restante := greatest(c.limite_diario - public.automacao_criados_hoje(), 0);

  if v_restante > 0 and jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) > 0 then
    insert into public.lotes_importacao (publicado_direto, total, automatico, filtros)
    values (true, 0, true, coalesce(p_filtros, '{}'::jsonb))
    returning id into v_lote;

    for it in select * from jsonb_array_elements(p_itens) loop
      exit when v_criados >= v_restante;
      begin
        v_nome := btrim(it ->> 'nome');
        v_link := btrim(it ->> 'link');
        v_img := btrim(it ->> 'imagem');
        v_ext := btrim(it ->> 'id_externo');
        v_slug := btrim(it ->> 'slug');
        v_preco := (it ->> 'preco')::numeric;
        v_cat := nullif(it ->> 'categoria_id', '')::uuid;

        if char_length(v_nome) not between 3 and 200
           or v_link !~ '^https://([a-z0-9-]+\.)*(shopee\.com\.br|shope\.ee)(/|$)' or char_length(v_link) > 2000 or v_link ~ '@'
           or v_img !~ '^https://' or char_length(v_img) > 2000
           or v_ext !~ '^[0-9]{1,19}\.[0-9]{1,19}$'
           or v_slug !~ '^[a-z0-9-]{3,120}$'
           or v_preco is null or v_preco <= 0 then
          v_ignorados := v_ignorados + 1;
          continue;
        end if;
        if v_cat is not null and not exists (select 1 from public.categorias k where k.id = v_cat and k.ativa) then
          v_cat := null;
        end if;
        if exists (select 1 from public.produtos p where p.id_externo = v_ext or p.link_afiliado = v_link) then
          v_ignorados := v_ignorados + 1;
          continue;
        end if;

        insert into public.produtos (nome, slug, preco_atual, link_afiliado, imagem_url, id_externo, categoria_id,
                                     origem, status_publicacao, disponibilidade, lote_id)
        values (v_nome, v_slug, v_preco, v_link, v_img, v_ext, v_cat, 'manual', 'publicado', 'disponivel', v_lote);
        v_criados := v_criados + 1;
      exception when others then
        v_ignorados := v_ignorados + 1;
      end;
    end loop;

    if v_criados = 0 then
      delete from public.lotes_importacao where id = v_lote;
      v_lote := null;
    else
      update public.lotes_importacao set total = v_criados where id = v_lote;
    end if;
  end if;

  update public.automacao_config
     set cursor_categoria = greatest(coalesce(p_cursor, cursor_categoria), 0),
         erros_seguidos = 0,
         ultima_execucao = now(),
         ultimo_resultado = case
           when v_restante = 0 then 'Limite diário já atingido: nada a fazer.'
           else v_criados || ' publicado(s), ' || v_ignorados || ' ignorado(s).'
         end,
         atualizado_em = now()
   where id = 1;

  return jsonb_build_object('criados', v_criados, 'ignorados', v_ignorados, 'lote_id', v_lote, 'restante_antes', v_restante);
end;
$$;
revoke all on function public.automacao_registrar(text, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.automacao_registrar(text, jsonb, jsonb, integer) to anon, authenticated;

-- Falha da rotina (Shopee fora do ar, limite de consultas...). Após 3 seguidas, pausa sozinha.
create function public.automacao_falha(p_chave text, p_msg text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_erros integer;
begin
  if not public.automacao_chave_ok(p_chave) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  update public.automacao_config
     set erros_seguidos = erros_seguidos + 1,
         ultima_execucao = now(),
         ultimo_resultado = 'Falha: ' || left(coalesce(p_msg, 'erro'), 200),
         atualizado_em = now()
   where id = 1
  returning erros_seguidos into v_erros;
  if v_erros >= 3 then
    update public.automacao_config
       set ativo = false, pausado_motivo = '3 falhas seguidas. Última: ' || left(coalesce(p_msg, 'erro'), 200)
     where id = 1;
  end if;
end;
$$;
revoke all on function public.automacao_falha(text, text) from public, anon, authenticated;
grant execute on function public.automacao_falha(text, text) to anon, authenticated;
