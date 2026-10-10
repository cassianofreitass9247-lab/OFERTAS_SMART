import type { Metadata } from "next";
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
      <h1 className="font-titulo text-3xl font-extrabold">Promoções</h1>
      <p className="mt-1 mb-4 max-w-[70ch] text-cinza">
        Só entram aqui produtos em que o site registrou uma queda de preço. O valor riscado é o último preço que nós mesmos anotamos antes da queda.
      </p>
      <ListaOfertas
        caminho="/promocoes"
        parametros={{ ordenar: "maior-desconto", ...parametros }}
        fixos={{ soPromocoes: true }}
        vazio="Nenhuma queda de preço registrada no momento."
      />
    </>
  );
}
