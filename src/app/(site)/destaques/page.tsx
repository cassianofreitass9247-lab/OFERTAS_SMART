import type { Metadata } from "next";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import { ListaOfertas } from "@/components/ListaOfertas";

export const metadata: Metadata = {
  title: "Em destaque",
  description: "Os achadinhos que a Moni separou para você olhar primeiro.",
  alternates: { canonical: "/destaques" },
};

export default async function PaginaDestaques({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = await searchParams;
  return (
    <>
      <Cabecalho titulo="Em destaque" subtitulo="Os achadinhos que a Moni separou para você olhar primeiro." />
      <Conteudo>
        <ListaOfertas caminho="/destaques" parametros={parametros} fixos={{ soDestaques: true }} vazio="Nenhum produto em destaque no momento." />
      </Conteudo>
    </>
  );
}
