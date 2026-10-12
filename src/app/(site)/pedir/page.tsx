import type { Metadata } from "next";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import { FormularioPedido } from "@/components/site/FormularioPedido";

export const metadata: Metadata = {
  title: "Pede pra Moni",
  description: "Não achou o produto que queria? Conte o que você procura e a Moni garimpa na Shopee e manda o link no seu WhatsApp.",
  alternates: { canonical: "/pedir" },
};

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PaginaPedir({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const busca = um((await searchParams).q).trim().slice(0, 200);
  return (
    <>
      <Cabecalho
        titulo="Pede pra Moni"
        subtitulo="Não achou o que queria? Conte o que você procura. Eu garimpo na Shopee e mando o link no seu WhatsApp."
      />
      <Conteudo estreito>
        <ol className="mb-8 grid list-none gap-3 p-0 sm:grid-cols-3">
          {["Você conta o que procura", "A Moni garimpa na Shopee", "O link chega no seu WhatsApp"].map((t, i) => (
            <li key={t} className="flex items-center gap-3 rounded-2xl border-[2.5px] border-tinta bg-pessego p-3 font-bold">
              <span className="flex size-9 flex-none items-center justify-center rounded-full bg-tinta font-titulo text-lg text-white">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        <FormularioPedido busca={busca} />
      </Conteudo>
    </>
  );
}
