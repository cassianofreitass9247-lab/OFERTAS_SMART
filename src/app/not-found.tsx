import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-titulo text-3xl font-extrabold">Página não encontrada</h1>
      <p className="mt-2 text-cinza">A oferta pode ter saído do ar ou o endereço está incorreto.</p>
      <Link href="/ofertas" className="botao mt-6">Ver ofertas publicadas</Link>
    </main>
  );
}
