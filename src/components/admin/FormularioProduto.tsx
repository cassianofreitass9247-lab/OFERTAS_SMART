"use client";

import { useActionState } from "react";
import { salvarProduto, type Estado } from "@/app/admin/acoes";
import type { Produto } from "@/lib/database.types";

type Props = { produto?: Produto; categorias: { id: string; nome: string }[] };

export function FormularioProduto({ produto, categorias }: Props) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(salvarProduto, {});
  const p = produto;
  // Depois de um erro, repõe o que a pessoa tinha digitado.
  const v = estado.valores;
  const txt = (campo: string, original: string | null | undefined) => (v ? (v[campo] ?? "") : (original ?? ""));
  const marcado = (campo: string, original: boolean | undefined) => (v ? v[campo] === "on" : original);
  // Os <select> recebem "key" com o valor: depois de um erro o React limpa o formulário e,
  // sem remontar, a lista voltaria ao valor inicial (ex.: "Publicado" virava "Rascunho").
  return (
    <form action={acao} className="max-w-2xl space-y-5">
      {p && <input type="hidden" name="id" value={p.id} />}

      <div>
        <label htmlFor="nome" className="rotulo">Nome do produto</label>
        <input id="nome" name="nome" required minLength={3} maxLength={200} defaultValue={txt("nome", p?.nome)} className="campo" />
      </div>

      <div>
        <label htmlFor="link_afiliado" className="rotulo">Link de afiliado</label>
        <input id="link_afiliado" name="link_afiliado" type="url" required defaultValue={txt("link_afiliado", p?.link_afiliado)} placeholder="https://s.shopee.com.br/…" className="campo" aria-describedby="d-link" />
        <p id="d-link" className="mt-1 text-sm text-cinza">Gere o link no painel de afiliados da Shopee e cole aqui. Só são aceitos links da Shopee.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="preco_atual" className="rotulo">Preço atual (R$)</label>
          <input id="preco_atual" name="preco_atual" inputMode="decimal" required defaultValue={txt("preco_atual", p ? p.preco_atual.toFixed(2).replace(".", ",") : "")} placeholder="59,90" className="campo" aria-describedby="d-preco" />
          <p id="d-preco" className="mt-1 text-sm text-cinza">
            Não existe campo de preço anterior: quando você baixar este preço, o sistema guarda o valor antigo e mostra o desconto sozinho.
          </p>
        </div>
        <div>
          <label htmlFor="categoria_id" className="rotulo">Categoria</label>
          <select key={txt("categoria_id", p?.categoria_id)} id="categoria_id" name="categoria_id" defaultValue={txt("categoria_id", p?.categoria_id)} className="campo">
            <option value="">Sem categoria</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>

      {p && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="correcao" defaultChecked={marcado("correcao", false)} className="mt-1 size-4" />
          <span>
            Estou corrigindo um preço digitado errado. <span className="text-cinza">Marque para que a correção não apareça no site como desconto.</span>
          </span>
        </label>
      )}

      <div>
        <label htmlFor="imagem_url" className="rotulo">Endereço da imagem (opcional)</label>
        <input id="imagem_url" name="imagem_url" type="url" defaultValue={txt("imagem_url", p?.imagem_url)} placeholder="https://…" className="campo" />
      </div>

      <div>
        <label htmlFor="video_url" className="rotulo">Link do vídeo (opcional)</label>
        {p?.video_url && <input type="hidden" name="tinha_video" value="1" />}
        <input id="video_url" name="video_url" type="url" defaultValue={txt("video_url", p?.video_url)} placeholder="https://www.youtube.com/shorts/… ou link do Shopee Video" className="campo" aria-describedby="d-video" />
        <p id="d-video" className="mt-1 text-sm text-cinza">
          YouTube, TikTok e Instagram tocam dentro do site. Shopee Video vira um botão que abre o vídeo na Shopee (a Shopee não permite tocar em outros
          sites). Também aceita um arquivo .mp4 com endereço https.
        </p>
      </div>

      <div>
        <label htmlFor="descricao" className="rotulo">Descrição (opcional)</label>
        <textarea id="descricao" name="descricao" rows={5} maxLength={5000} defaultValue={txt("descricao", p?.descricao)} className="campo" />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="status_publicacao" className="rotulo">Situação no site</label>
          <select key={txt("status_publicacao", p?.status_publicacao ?? "rascunho")} id="status_publicacao" name="status_publicacao" defaultValue={txt("status_publicacao", p?.status_publicacao ?? "rascunho")} className="campo">
            <option value="rascunho">Rascunho (não aparece)</option>
            <option value="publicado">Publicado</option>
            <option value="despublicado">Despublicado</option>
          </select>
        </div>
        <div>
          <label htmlFor="disponibilidade" className="rotulo">Disponibilidade</label>
          <select key={txt("disponibilidade", p?.disponibilidade ?? "desconhecido")} id="disponibilidade" name="disponibilidade" defaultValue={txt("disponibilidade", p?.disponibilidade ?? "desconhecido")} className="campo">
            <option value="desconhecido">Não verificada</option>
            <option value="disponivel">Disponível</option>
            <option value="indisponivel">Indisponível</option>
          </select>
        </div>
        <div>
          <label htmlFor="id_externo" className="rotulo">ID na Shopee (opcional)</label>
          <input id="id_externo" name="id_externo" maxLength={64} defaultValue={txt("id_externo", p?.id_externo)} className="campo" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="destaque" defaultChecked={marcado("destaque", p?.destaque)} className="size-4" />
        Mostrar em “Em destaque” na página inicial
      </label>

      {estado.erro && <p role="alert" className="rounded-md border border-laranja bg-laranja-claro p-3 text-sm">{estado.erro}</p>}

      <button type="submit" disabled={enviando} className="botao">{enviando ? "Salvando…" : p ? "Salvar alterações" : "Cadastrar produto"}</button>
    </form>
  );
}
