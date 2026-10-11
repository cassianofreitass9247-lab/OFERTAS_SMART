import type { Metadata } from "next";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import { ListaSalvos } from "@/components/site/ListaSalvos";

export const metadata: Metadata = { title: "Meus salvos", robots: { index: false, follow: false } };

export default function PaginaSalvos() {
  return (
    <>
      <Cabecalho titulo="Meus salvos" subtitulo="Os achadinhos que você marcou com o coração. A lista fica só neste navegador." />
      <Conteudo>
        <ListaSalvos />
      </Conteudo>
    </>
  );
}
