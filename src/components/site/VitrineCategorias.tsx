"use client";

import { useState } from "react";
import { CartaoProduto } from "@/components/CartaoProduto";
import type { ProdutoCartao } from "@/lib/dados";

type Item = ProdutoCartao & { categoriaNome?: string };

/** Grade de achadinhos com filtro instantâneo por categoria (sem recarregar a página). */
export function VitrineCategorias({ produtos }: { produtos: Item[] }) {
  const [filtro, setFiltro] = useState<string | null>(null);

  const categorias: { id: string; nome: string }[] = [];
  for (const p of produtos) {
    if (p.categoria_id && p.categoriaNome && !categorias.some((c) => c.id === p.categoria_id)) {
      categorias.push({ id: p.categoria_id, nome: p.categoriaNome });
    }
  }
  categorias.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const visiveis = filtro ? produtos.filter((p) => p.categoria_id === filtro) : produtos;

  const chip = (ativo: boolean) =>
    `vm-btn min-h-[46px] cursor-pointer rounded-full border-[2.5px] border-tinta px-5 text-base font-bold ${ativo ? "bg-tinta text-white" : "bg-white text-tinta"}`;

  return (
    <>
      {categorias.length > 1 && (
        <div role="group" aria-label="Filtrar por categoria" className="mb-7 flex flex-wrap gap-2.5">
          <button type="button" onClick={() => setFiltro(null)} aria-pressed={filtro === null} className={chip(filtro === null)}>
            Tudo
          </button>
          {categorias.map((c) => (
            <button key={c.id} type="button" onClick={() => setFiltro(c.id)} aria-pressed={filtro === c.id} className={chip(filtro === c.id)}>
              {c.nome}
            </button>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4" aria-live="polite">
        {visiveis.map((p) => (
          <CartaoProduto key={p.id} produto={p} categoria={p.categoriaNome} />
        ))}
      </ul>
    </>
  );
}
