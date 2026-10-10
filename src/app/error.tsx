"use client";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-titulo text-3xl font-extrabold">Não foi possível carregar esta página</h1>
      <p className="mt-2 text-cinza">O banco de dados não respondeu. Tente de novo em alguns instantes.</p>
      <button type="button" onClick={reset} className="botao mt-6">Tentar de novo</button>
    </main>
  );
}
