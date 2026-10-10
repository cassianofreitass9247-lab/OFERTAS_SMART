import type { Metadata } from "next";
import Link from "next/link";
import { listarCategorias } from "@/lib/dados";

// Dados ao vivo: a página é montada a cada acesso (não é gerada no build).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Categorias", description: "Ofertas da Shopee organizadas por categoria.", alternates: { canonical: "/categorias" } };

export default async function PaginaCategorias() {
  const categorias = await listarCategorias();
  return (
    <>
      <h1 className="mb-4 font-titulo text-3xl font-extrabold">Categorias</h1>
      {categorias.length === 0 ? (
        <p className="rounded-lg border border-dashed border-linha bg-white p-8 text-center">Nenhuma categoria cadastrada ainda.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categorias.map((c) => (
            <li key={c.id}>
              <Link href={`/categorias/${c.slug}`} className="block rounded-lg border border-linha bg-white p-4 hover:border-cinza">
                <span className="font-titulo text-lg font-bold">{c.nome}</span>
                {c.descricao && <span className="mt-1 block text-sm text-cinza">{c.descricao}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
