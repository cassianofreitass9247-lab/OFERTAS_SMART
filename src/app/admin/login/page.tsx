import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { bancoConfigurado } from "@/lib/config";
import { configTurnstile } from "@/lib/turnstile";
import { FormularioLogin } from "./FormularioLogin";

export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false, follow: false } };

export default async function PaginaLogin() {
  await connection(); // lê a chave do Turnstile em tempo de execução (variável do Worker)
  const { siteKey, ativo } = configTurnstile();
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-titulo text-3xl font-extrabold">Painel da Vitrine da Moni</h1>
      {bancoConfigurado() ? (
        <FormularioLogin siteKey={ativo ? siteKey : ""} />
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
