import type { Metadata } from "next";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import { ListaOfertas } from "@/components/ListaOfertas";

export const metadata: Metadata = {
  title: "Promoções: produtos que baixaram de preço",
  description: "Produtos cujo preço caiu desde o último registro feito pelo site.",
  alternates: { canonical: "/promocoes" },
};

export default async function PaginaPromocoes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = await searchParams;
  return (
    <>
      <Cabecalho
        titulo="Preço caiu"
        subtitulo="Só entram aqui produtos em que o site registrou uma queda de preço. O valor riscado é o último preço anotado antes da queda."
      />
      <Conteudo>
      <ListaOfertas
        caminho="/promocoes"
        parametros={{ ordenar: "maior-desconto", ...parametros }}
        fixos={{ soPromocoes: true }}
        vazio="Nenhuma queda de preço registrada no momento."
      />
      </Conteudo>
    </>
  );
}
