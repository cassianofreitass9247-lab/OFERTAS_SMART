"use client";

import { useState } from "react";

/** Mostra o código e copia para a área de transferência. Conta o uso sem dados pessoais. */
export function BotaoCopiarCupom({ id, codigo }: { id: string; codigo: string }) {
  const [estado, setEstado] = useState<"parado" | "copiado" | "erro">("parado");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setEstado("copiado");
    } catch {
      setEstado("erro"); // sem permissão de cópia: o código continua visível para copiar à mão
    }
    try {
      void fetch(`/cupom/${id}`, { method: "POST", keepalive: true });
    } catch {
      /* contagem é opcional */
    }
    setTimeout(() => setEstado("parado"), 2500);
  }

  return (
    <div className="flex items-stretch overflow-hidden rounded-2xl border-[2.5px] border-dashed border-tinta bg-pessego">
      <code className="flex min-w-0 flex-1 items-center px-3 py-2.5 font-mono text-base font-bold tracking-wider break-all select-all">{codigo}</code>
      <button
        type="button"
        onClick={copiar}
        className="vm-btn flex-none border-l-[2.5px] border-dashed border-tinta bg-tinta px-4 font-bold text-white"
        aria-live="polite"
      >
        {estado === "copiado" ? "Copiado!" : estado === "erro" ? "Copie à mão" : "Copiar código"}
      </button>
    </div>
  );
}
