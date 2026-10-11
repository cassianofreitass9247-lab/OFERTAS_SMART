import type { Metadata } from "next";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import { IconeCategoria } from "@/components/site/Icones";
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
      <Cabecalho titulo={categoria.nome} subtitulo={categoria.descricao ?? undefined}>
        <span className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl border-[2.5px] border-tinta bg-white shadow-duro-p">
          <IconeCategoria slug={categoria.slug} tamanho={28} />
        </span>
      </Cabecalho>
      <Conteudo>
        <ListaOfertas
          caminho={`/categorias/${categoria.slug}`}
          parametros={await searchParams}
          fixos={{ categoriaId: categoria.id }}
          vazio="Ainda não há ofertas publicadas nesta categoria."
        />
      </Conteudo>
    </>
  );
}
