import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { bancoConfigurado } from "@/lib/config";
import { clienteServidor } from "@/lib/supabase/servidor";
import { sair } from "../acoes";

export const metadata: Metadata = { title: { default: "Painel", template: "%s | Painel Vitrine da Moni" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const MENU = [
  { href: "/admin", rotulo: "Resumo" },
  { href: "/admin/produtos", rotulo: "Produtos" },
  { href: "/admin/importar", rotulo: "Importar CSV" },
  { href: "/admin/categorias", rotulo: "Categorias" },
];

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  if (!bancoConfigurado()) redirect("/admin/login");

  const sb = await clienteServidor();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/admin/login");
  const { data: admin } = await sb.rpc("eh_admin");

  const botaoSair = (
    <form action={sair}>
      <button type="submit" className="text-sm font-semibold underline">Sair</button>
    </form>
  );

  if (!admin) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="font-titulo text-2xl font-extrabold">Conta sem permissão de administrador</h1>
        <p className="mt-2 mb-4 text-cinza">A conta {data.user.email} existe, mas não foi liberada como administradora. Veja no README como liberar.</p>
        {botaoSair}
      </main>
    );
  }

  return (
    <>
      <header className="border-b border-linha bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-titulo text-xl font-extrabold">Painel Vitrine da Moni</Link>
          <nav aria-label="Painel" className="flex flex-wrap gap-4 text-sm font-semibold">
            {MENU.map((m) => (
              <Link key={m.href} href={m.href} className="py-1 hover:text-laranja-forte">{m.rotulo}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <Link href="/" className="text-sm underline">Ver o site</Link>
            {botaoSair}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
