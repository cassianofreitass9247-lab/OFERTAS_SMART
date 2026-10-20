import type { Metadata } from "next";
import { connection } from "next/server";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import { FormularioPedido } from "@/components/site/FormularioPedido";
import { configTurnstile } from "@/lib/turnstile";
import { F } from "@/lib/marca";

export const metadata: Metadata = {
  title: `Pede ${F.pra}`,
  description: `Não achou o produto que queria? Conte o que você procura e ${F.a} garimpa na Shopee e manda o link no seu WhatsApp.`,
  alternates: { canonical: "/pedir" },
};

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PaginaPedir({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const busca = um((await searchParams).q).trim().slice(0, 200);
  await connection(); // lê a chave do Turnstile em tempo de execução (variável do Worker)
  const { siteKey, ativo } = configTurnstile();
  return (
    <>
      <Cabecalho
        titulo={`Pede ${F.pra}`}
        subtitulo="Não achou o que queria? Conte o que você procura. Eu garimpo na Shopee e mando o link no seu WhatsApp."
      />
      <Conteudo estreito>
        <ol className="mb-8 grid list-none gap-3 p-0 sm:grid-cols-3">
          {["Você conta o que procura", `${F.A} garimpa na Shopee`, "O link chega no seu WhatsApp"].map((t, i) => (
            <li key={t} className="flex items-center gap-3 rounded-2xl border-[2.5px] border-tinta bg-pessego p-3 font-bold">
              <span className="flex size-9 flex-none items-center justify-center rounded-full bg-tinta font-titulo text-lg text-white">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        <FormularioPedido busca={busca} siteKey={ativo ? siteKey : ""} />
      </Conteudo>
    </>
  );
}
