"use client";

// Produtos salvos (coração). Ficam só no navegador da pessoa (localStorage):
// nada vai para o servidor e não há cadastro. Se o navegador bloquear o
// armazenamento, o coração continua funcionando até a página ser fechada.

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CAMINHO_CORACAO } from "./Icones";

const CHAVE = "vitrine-da-moni:salvos";
const LIMITE = 200;

type Contexto = { salvos: string[]; pronto: boolean; alternar: (id: string) => void };
const SalvosContexto = createContext<Contexto>({ salvos: [], pronto: false, alternar: () => {} });

export function SalvosProvider({ children }: { children: React.ReactNode }) {
  const [salvos, setSalvos] = useState<string[]>([]);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    try {
      const lido: unknown = JSON.parse(window.localStorage.getItem(CHAVE) ?? "[]");
      if (Array.isArray(lido)) setSalvos(lido.filter((x): x is string => typeof x === "string").slice(-LIMITE));
    } catch {
      // armazenamento indisponível: começa vazio
    }
    setPronto(true);
  }, []);

  const alternar = useCallback((id: string) => {
    setSalvos((atual) => {
      const novo = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id].slice(-LIMITE);
      try {
        window.localStorage.setItem(CHAVE, JSON.stringify(novo));
      } catch {
        // segue só na memória
      }
      return novo;
    });
  }, []);

  return <SalvosContexto.Provider value={{ salvos, pronto, alternar }}>{children}</SalvosContexto.Provider>;
}

export const useSalvos = () => useContext(SalvosContexto);

export function BotaoSalvar({ id, nome, grande = false }: { id: string; nome: string; grande?: boolean }) {
  const { salvos, alternar } = useSalvos();
  const salvo = salvos.includes(id);
  const t = grande ? 52 : 44;
  return (
    <button
      type="button"
      onClick={() => alternar(id)}
      aria-pressed={salvo}
      aria-label={salvo ? `Remover ${nome} dos salvos` : `Salvar ${nome}`}
      className="vm-coracao flex cursor-pointer items-center justify-center rounded-full border-2 border-tinta bg-white"
      style={{ width: t, height: t }}
    >
      <svg width={grande ? 26 : 20} height={grande ? 26 : 20} viewBox="0 0 24 24" aria-hidden="true">
        <path d={CAMINHO_CORACAO} fill={salvo ? "#ff3d6e" : "#ffffff"} stroke="#1e120c" strokeWidth={2} />
      </svg>
    </button>
  );
}

export function ContadorSalvos() {
  const { salvos, pronto } = useSalvos();
  const qtd = pronto ? salvos.length : 0;
  return (
    <Link
      href="/salvos"
      aria-label={qtd === 1 ? "1 produto salvo" : `${qtd} produtos salvos`}
      className="vm-btn relative inline-flex size-[50px] items-center justify-center rounded-full border-[2.5px] border-tinta bg-white"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d={CAMINHO_CORACAO} fill="#ff3d6e" stroke="#1e120c" strokeWidth={2} />
      </svg>
      <span className="absolute -top-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-tinta bg-sol px-1.5 text-[13px] font-extrabold text-tinta">
        {qtd}
      </span>
    </Link>
  );
}
