"use client";
/* eslint-disable @next/next/no-img-element -- imagens externas sem otimizador pago */

import Link from "next/link";
import { useState } from "react";
import { importarLoteShopee } from "@/app/admin/shopee-lote-acoes";

export type ItemGrade = {
  itemId: string;
  shopId: string;
  nome: string;
  link: string;
  preco: number;
  precoTexto: string;
  imagem: string | null;
  loja: string | null;
  desconto: number | null;
  comissao: number | null;
  vendas: number | null;
  nota: number | null;
  existente: string | null; // id do produto, se já cadastrado
  bloqueado: boolean;
};

type Props = {
  itens: ItemGrade[];
  categorias: { id: string; nome: string }[];
  volta: string;
  filtros: Record<string, string>;
  max: number;
};

const compacto = (i: ItemGrade) => JSON.stringify({ i: i.itemId, s: i.shopId, n: i.nome, l: i.link, p: i.preco, m: i.imagem });

export function GradeLote({ itens, categorias, volta, filtros, max }: Props) {
  const novos = itens.filter((i) => !i.existente);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(novos.slice(0, max).map((i) => i.itemId)));
  const [direto, setDireto] = useState(false);
  const [confirmo, setConfirmo] = useState(false);

  const alternar = (id: string) =>
    setMarcados((atual) => {
      const n = new Set(atual);
      if (n.has(id)) n.delete(id);
      else if (n.size < max) n.add(id);
      return n;
    });
  const total = marcados.size;
  const retidos = direto ? itens.filter((i) => marcados.has(i.itemId) && (i.bloqueado || !i.imagem)).length : 0;
  const rotulo = total === 0 ? "Selecione produtos" : direto ? `Publicar ${total} produto${total > 1 ? "s" : ""} agora` : `Criar ${total} rascunho${total > 1 ? "s" : ""}`;
  const bloqueia = total === 0 || (direto && !confirmo);

  return (
    <form action={importarLoteShopee}>
      <input type="hidden" name="volta" value={volta} />
      {Object.entries(filtros).map(([k, v]) => (
        <input key={k} type="hidden" name={`f_${k}`} value={v} />
      ))}
      {itens.filter((i) => marcados.has(i.itemId)).map((i) => (
        <input key={i.itemId} type="hidden" name="item" value={compacto(i)} />
      ))}

      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="botao-secundario" onClick={() => setMarcados(new Set(novos.slice(0, max).map((i) => i.itemId)))}>Marcar todos</button>
        <button type="button" className="botao-secundario" onClick={() => setMarcados(new Set())}>Desmarcar todos</button>
        <span aria-live="polite" data-testid="contador"><strong>{total}</strong> de {max} possíveis selecionados</span>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {itens.map((o) => {
          const marcado = marcados.has(o.itemId);
          return (
            <li key={o.itemId} className={`flex gap-3 rounded-lg border bg-white p-3 ${marcado ? "border-laranja" : "border-linha"}`}>
              {o.existente ? (
                <span className="mt-1 w-5 flex-none" aria-hidden />
              ) : (
                <input type="checkbox" id={`sel-${o.itemId}`} checked={marcado} onChange={() => alternar(o.itemId)} className="mt-1 size-5 flex-none" aria-label={`Selecionar ${o.nome}`} />
              )}
              {o.imagem ? (
                <img src={o.imagem} alt="" width={80} height={80} referrerPolicy="no-referrer" loading="lazy" className="size-20 flex-none rounded-md bg-white object-contain" />
              ) : (
                <div className="flex size-20 flex-none items-center justify-center rounded-md bg-fundo text-xs text-cinza">Sem foto</div>
              )}
              <label htmlFor={o.existente ? undefined : `sel-${o.itemId}`} className="min-w-0 flex-1 cursor-pointer text-sm">
                <span className="line-clamp-2 font-semibold leading-snug">{o.nome}</span>
                <span className="mt-1 block">
                  <span className="preco font-extrabold">{o.precoTexto}</span>
                  {o.desconto ? <span className="ml-2 rounded bg-laranja-claro px-1.5 py-0.5 text-xs font-semibold">{o.desconto}% off</span> : null}
                </span>
                <span className="block text-xs text-cinza">
                  {o.comissao !== null && <>Comissão {o.comissao.toLocaleString("pt-BR")}%</>}
                  {o.vendas !== null && <> · {o.vendas.toLocaleString("pt-BR")} vendas</>}
                  {o.nota !== null && <> · nota {o.nota.toLocaleString("pt-BR")}</>}
                </span>
                {o.bloqueado && <span className="mt-1 block text-xs font-semibold">⚠ Nome com termo sensível: na publicação direta fica como rascunho.</span>}
              </label>
              {o.existente && <Link href={`/admin/produtos/${o.existente}`} className="self-start text-xs underline">Já cadastrado</Link>}
            </li>
          );
        })}
      </ul>

      <fieldset className="mt-6 space-y-4 rounded-lg border border-linha bg-white p-4">
        <legend className="px-1 font-semibold">Importar os selecionados</legend>
        <div className="max-w-sm">
          <label htmlFor="categoria_id" className="rotulo">Categoria (vale para todo o lote)</label>
          <select id="categoria_id" name="categoria_id" className="campo" defaultValue="">
            <option value="">Sem categoria</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="radio" name="modo" value="rascunho" checked={!direto} onChange={() => { setDireto(false); setConfirmo(false); }} className="mt-1" />
            <span><strong>Criar como rascunho</strong> (recomendado). Você revisa e publica um a um ou em massa.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="modo" value="direto" checked={direto} onChange={() => setDireto(true)} className="mt-1" />
            <span><strong>Publicar direto, sem rascunho</strong> (opcional). Vai ao ar na hora, sem descrição e sem sua revisão.</span>
          </label>
        </div>

        {direto && (
          <div role="note" className="rounded-md border border-laranja bg-laranja-claro p-3 text-sm">
            <p className="font-semibold">Antes de publicar direto:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Só vão ao ar produtos com foto, preço e sem termo sensível; os demais ficam como rascunho{retidos > 0 ? ` (${retidos} neste lote)` : ""}.</li>
              <li>Preço, estoque e regras do programa de afiliados da Shopee são de sua responsabilidade.</li>
              <li>O lote fica registrado e dá para desfazer tudo de uma vez logo depois.</li>
            </ul>
            <label className="mt-2 flex items-start gap-2">
              <input type="checkbox" name="confirmo" value="sim" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} className="mt-1" />
              <span>Entendi e quero publicar este lote direto no site.</span>
            </label>
          </div>
        )}

        <button type="submit" className="botao" disabled={bloqueia}>{rotulo}</button>
      </fieldset>
    </form>
  );
}
