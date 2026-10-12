"use client";

/* eslint-disable @next/next/no-img-element -- imagens externas, sem otimizador pago */
import { useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ImagemProduto } from "../ImagemProduto";

const Seta = ({ esquerda }: { esquerda?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={esquerda ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </svg>
);

/**
 * Galeria do produto: imagem grande + miniaturas. Troca por miniatura, setas, deslize do dedo
 * ou teclado (← →). Uma foto que não carrega sai da galeria em vez de mostrar um ícone quebrado.
 * Com uma foto só, fica igual à página de antes. `selo` é o selo de desconto, que fica sobre o quadro.
 */
export function GaleriaProduto({ imagens, nome, selo }: { imagens: string[]; nome: string; selo?: ReactNode }) {
  const [quebradas, setQuebradas] = useState<ReadonlySet<string>>(new Set());
  const [indice, setIndice] = useState(0);
  const inicioToque = useRef<number | null>(null);

  const lista = imagens.filter((u) => !quebradas.has(u));
  const total = lista.length;
  const atual = Math.min(indice, Math.max(total - 1, 0));

  const ir = useCallback((i: number) => setIndice(total ? (i + total) % total : 0), [total]);
  const marcarQuebrada = (u: string) => setQuebradas((q) => new Set(q).add(u));

  function aoTeclar(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      ir(atual - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      ir(atual + 1);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="relative rounded-[30px] border-[3px] border-tinta bg-pessego p-4 shadow-duro">
        <div
          className="relative overflow-hidden rounded-[22px] border-2 border-tinta bg-white"
          role="group"
          aria-roledescription="galeria"
          aria-label={`Fotos de ${nome}`}
          tabIndex={total > 1 ? 0 : undefined}
          onKeyDown={total > 1 ? aoTeclar : undefined}
          onTouchStart={(e) => (inicioToque.current = e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            const inicio = inicioToque.current;
            inicioToque.current = null;
            const fim = e.changedTouches[0]?.clientX;
            if (inicio === null || fim === undefined || total < 2) return;
            if (Math.abs(fim - inicio) > 40) ir(atual + (fim < inicio ? 1 : -1));
          }}
        >
          {total === 0 ? (
            <ImagemProduto url={null} nome={nome} />
          ) : (
            <img
              key={lista[atual]}
              src={lista[atual]}
              alt={total > 1 ? `${nome} — foto ${atual + 1} de ${total}` : nome}
              width={600}
              height={600}
              loading={atual === 0 ? "eager" : "lazy"}
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => marcarQuebrada(lista[atual])}
              className="aspect-square w-full bg-white object-contain"
            />
          )}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => ir(atual - 1)}
                aria-label="Foto anterior"
                className="absolute top-1/2 left-2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-tinta bg-white p-0 text-tinta shadow-duro-p"
              >
                <Seta esquerda />
              </button>
              <button
                type="button"
                onClick={() => ir(atual + 1)}
                aria-label="Próxima foto"
                className="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 border-tinta bg-white p-0 text-tinta shadow-duro-p"
              >
                <Seta />
              </button>
              <span
                aria-hidden="true"
                className="absolute right-2 bottom-2 rounded-full border-2 border-tinta bg-white px-2.5 py-0.5 text-xs font-extrabold text-tinta"
              >
                {atual + 1}/{total}
              </span>
            </>
          )}
        </div>
        {selo && <span className="absolute -top-5 -right-4">{selo}</span>}
      </div>

      {total > 1 && (
        <ul className="vm-sem-barra m-0 flex list-none gap-2.5 overflow-x-auto p-1" aria-label="Escolher foto">
          {lista.map((u, i) => (
            <li key={u} className="flex-none">
              <button
                type="button"
                onClick={() => setIndice(i)}
                aria-label={`Ver foto ${i + 1} de ${total}`}
                aria-current={i === atual ? "true" : undefined}
                className={`block size-[72px] cursor-pointer overflow-hidden rounded-2xl border-[3px] bg-white p-0 ${
                  i === atual ? "border-tinta shadow-duro-p" : "border-tinta/25 opacity-80"
                }`}
              >
                <img
                  src={u}
                  alt=""
                  width={72}
                  height={72}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => marcarQuebrada(u)}
                  className="size-full object-contain"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
