import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListaOfertas } from "@/components/ListaOfertas";
import { listarCategorias } from "@/lib/dados";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function buscar(slug: string) {
  return (await listarCategorias()).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const categoria = await buscar((await params).slug);
  if (!categoria) return { title: "Categoria não encontrada" };
  return {
    title: `Ofertas de ${categoria.nome}`,
    description: categoria.descricao ?? `Ofertas da Shopee na categoria ${categoria.nome}.`,
    alternates: { canonical: `/categorias/${categoria.slug}` },
  };
}

export default async function PaginaCategoria({ params, searchParams }: Props) {
  const categoria = await buscar((await params).slug);
  if (!categoria) notFound();
  return (
    <>
      <h1 className="font-titulo text-3xl font-extrabold">{categoria.nome}</h1>
      {categoria.descricao && <p className="mt-1 max-w-[70ch] text-cinza">{categoria.descricao}</p>}
      <div className="mt-4">
        <ListaOfertas
          caminho={`/categorias/${categoria.slug}`}
          parametros={await searchParams}
          fixos={{ categoriaId: categoria.id }}
          vazio="Ainda não há ofertas publicadas nesta categoria."
        />
      </div>
    </>
  );
}
