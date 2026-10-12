-- Vitrine da Moni — migração 0003: galeria de imagens do produto
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Execute uma única vez, depois da 0002. Não apaga nem altera dados existentes.
--
-- A capa continua em produtos.imagem_url. A nova coluna "imagens" guarda as fotos
-- ADICIONAIS (outras perspectivas), em ordem, até 7 — com a capa, são 8 no total.

create function public.imagens_validas(p_imagens text[])
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(bool_and(x ~ '^https://' and char_length(x) <= 2000), true) from unnest(p_imagens) as x;
$$;

alter table public.produtos
  add column imagens text[] not null default '{}'
  check (cardinality(imagens) <= 7 and public.imagens_validas(imagens));

-- ---------------------------------------------------------------------------
-- Importação por CSV passa a aceitar a coluna de imagens adicionais
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
  v_imgs text[];
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

    v_imgs := coalesce(
      array(select jsonb_array_elements_text(case when jsonb_typeof(it -> 'imagens') = 'array' then it -> 'imagens' else '[]'::jsonb end)),
      '{}'
    );

    v_id := null;
    if nullif(it ->> 'id_externo', '') is not null then
      select p.id into v_id from public.produtos p where p.id_externo = it ->> 'id_externo';
    end if;
    if v_id is null then
      select p.id into v_id from public.produtos p where p.link_afiliado = it ->> 'link_afiliado';
    end if;

    if v_id is null then
      insert into public.produtos (
        nome, slug, descricao, imagem_url, imagens, video_url, categoria_id, preco_atual,
        link_afiliado, id_externo, origem, status_publicacao
      ) values (
        it ->> 'nome', it ->> 'slug', nullif(it ->> 'descricao', ''), nullif(it ->> 'imagem_url', ''),
        v_imgs,
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
        -- coluna vazia no arquivo mantém a galeria que já existe
        imagens = case when cardinality(v_imgs) > 0 then v_imgs else p.imagens end,
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
