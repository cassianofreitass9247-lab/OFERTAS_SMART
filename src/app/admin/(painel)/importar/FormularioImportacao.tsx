"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importarCsv, type EstadoImportacao } from "../../acoes";

export function FormularioImportacao() {
  const [estado, acao, enviando] = useActionState<EstadoImportacao, FormData>(importarCsv, {});
  const r = estado.resultado;

  return (
    <div className="max-w-2xl">
      <form action={acao} className="space-y-4 rounded-lg border border-linha bg-white p-4">
        <div>
          <label htmlFor="arquivo" className="rotulo">Arquivo CSV</label>
          <input id="arquivo" name="arquivo" type="file" accept=".csv,text/csv" required className="campo file:mr-3 file:rounded file:border-0 file:bg-fundo file:px-3 file:py-1.5 file:font-semibold" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="so_validar" className="size-4" />
          Só conferir o arquivo, sem gravar nada
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="publicar" className="size-4" />
          Publicar os produtos novos imediatamente (sem marcar, entram como rascunho)
        </label>
        <button type="submit" disabled={enviando} className="botao">{enviando ? "Processando…" : "Enviar arquivo"}</button>
      </form>

      <div aria-live="polite" className="mt-4 space-y-3">
        {estado.erro && <p role="alert" className="rounded-md border border-laranja bg-laranja-claro p-3 text-sm">{estado.erro}</p>}

        {r && (
          <div className="rounded-lg border border-linha bg-white p-4 text-sm">
            <h2 className="mb-2 font-titulo text-lg font-bold">{r.gravado ? "Importação concluída" : "Conferência do arquivo (nada foi gravado)"}</h2>
            <ul className="space-y-1">
              <li>{r.totalLinhas} linhas de produto no arquivo</li>
              {r.gravado ? (
                <>
                  <li>{r.inseridos} produtos novos cadastrados</li>
                  <li>{r.atualizados} produtos já existentes atualizados</li>
                </>
              ) : (
                <li>{r.validos} linhas válidas, prontas para importar</li>
              )}
              <li>{r.erros.length} linhas rejeitadas</li>
            </ul>
            {r.gravado && <p className="mt-3"><Link href="/admin/produtos" className="font-semibold text-laranja-forte underline">Ver produtos</Link></p>}

            {r.avisos.map((a) => <p key={a} className="mt-3 text-cinza">{a}</p>)}

            {r.erros.length > 0 && (
              <>
                <h3 className="mt-4 mb-1 font-semibold">Linhas rejeitadas e como corrigir</h3>
                <ul className="max-h-80 space-y-1 overflow-y-auto">
                  {r.erros.map((e) => <li key={e.linha}>Linha {e.linha}: {e.motivo}</li>)}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
