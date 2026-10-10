import type { Metadata } from "next";
import Link from "next/link";
import { bancoConfigurado } from "@/lib/config";
import { FormularioLogin } from "./FormularioLogin";

export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false, follow: false } };

export default function PaginaLogin() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-titulo text-3xl font-extrabold">Painel do OfertaSmart</h1>
      {bancoConfigurado() ? (
        <FormularioLogin />
      ) : (
        <p className="mt-4 rounded-lg bg-tinta p-4 text-sm text-white">
          Configuração pendente: o banco de dados ainda não foi conectado. Siga o passo a passo do arquivo README e volte aqui.
        </p>
      )}
      <p className="mt-6 text-sm">
        <Link href="/" className="underline">Voltar ao site</Link>
      </p>
    </main>
  );
}
