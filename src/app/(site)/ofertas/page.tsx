import type { Metadata } from "next";
import { ListaOfertas } from "@/components/ListaOfertas";

export const metadata: Metadata = {
  title: "Todas as ofertas",
  description: "Lista completa de ofertas da Shopee publicadas no site, com busca e ordenação por preço ou desconto.",
  alternates: { canonical: "/ofertas" },
};

export default async function PaginaOfertas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <>
      <h1 className="mb-4 font-titulo text-3xl font-extrabold">Todas as ofertas</h1>
      <ListaOfertas caminho="/ofertas" parametros={await searchParams} vazio="Ainda não há ofertas publicadas." />
    </>
  );
}
