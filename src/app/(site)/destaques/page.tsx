import type { Metadata } from "next";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import { ListaOfertas } from "@/components/ListaOfertas";
import { F } from "@/lib/marca";

export const metadata: Metadata = {
  title: "Em destaque",
  description: `Os achadinhos que ${F.a} separou para você olhar primeiro.`,
  alternates: { canonical: "/destaques" },
};

export default async function PaginaDestaques({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = await searchParams;
  return (
    <>
      <Cabecalho titulo="Em destaque" subtitulo={`Os achadinhos que ${F.a} separou para você olhar primeiro.`} />
      <Conteudo>
        <ListaOfertas caminho="/destaques" parametros={parametros} fixos={{ soDestaques: true }} vazio="Nenhum produto em destaque no momento." />
      </Conteudo>
    </>
  );
}
