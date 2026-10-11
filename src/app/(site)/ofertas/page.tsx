import type { Metadata } from "next";
import { ListaOfertas } from "@/components/ListaOfertas";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";

type Busca = Record<string, string | string[] | undefined>;

export async function generateMetadata({ searchParams }: { searchParams: Promise<Busca> }): Promise<Metadata> {
  const ate = Number((await searchParams).ate) || 0;
  return {
    title: ate > 0 ? `Achadinhos até R$ ${ate}` : "Todas as ofertas",
    description: "Todos os achadinhos da Shopee publicados na Vitrine da Moni, com busca e ordenação por preço ou desconto.",
    alternates: { canonical: "/ofertas" },
  };
}

export default async function PaginaOfertas({ searchParams }: { searchParams: Promise<Busca> }) {
  const parametros = await searchParams;
  const ate = Number(Array.isArray(parametros.ate) ? parametros.ate[0] : parametros.ate) || 0;
  return (
    <>
      <Cabecalho
        titulo={ate > 0 ? `Achadinhos até R$ ${ate}` : "Todas as ofertas"}
        subtitulo="Busque pelo nome ou ordene por preço e por desconto."
      />
      <Conteudo>
        <ListaOfertas caminho="/ofertas" parametros={parametros} vazio="Ainda não há ofertas publicadas." />
      </Conteudo>
    </>
  );
}
