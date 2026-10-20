import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { bancoConfigurado } from "@/lib/config";
import { clienteServidor } from "@/lib/supabase/servidor";
import { chaveDaAutomacao, hashDaChaveAutomacao } from "@/lib/automacao";
import { chaveDePedidos, hashDaChave } from "@/lib/turnstile";
import { sair } from "../acoes";
import { NOME_SITE } from "@/lib/config";

export const metadata: Metadata = { title: { default: "Painel", template: `%s | Painel ${NOME_SITE}` }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const MENU = [
  { href: "/admin", rotulo: "Resumo" },
  { href: "/admin/produtos", rotulo: "Produtos" },
  { href: "/admin/pedidos", rotulo: "Pedidos" },
  { href: "/admin/shopee", rotulo: "Importar da Shopee" },
  { href: "/admin/shopee/lote", rotulo: "Importar em lote" },
  { href: "/admin/automacao", rotulo: "Automação" },
  { href: "/admin/importar", rotulo: "Importar CSV" },
  { href: "/admin/cupons", rotulo: "Cupons" },
  { href: "/admin/categorias", rotulo: "Categorias" },
];

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  if (!bancoConfigurado()) redirect("/admin/login");

  const sb = await clienteServidor();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/admin/login");
  const { data: admin } = await sb.rpc("eh_admin");

  // Registra no banco o hash da chave que o servidor usa para criar pedidos (derivada do segredo do
  // Turnstile). Sem Turnstile configurado, limpa o registro e o banco volta a aceitar pedidos sem chave.
  // Falha silenciosa se a migração 0004 ainda não foi aplicada.
  if (admin) {
    const chave = await chaveDePedidos();
    await sb.rpc("sincronizar_chave_servidor", { p_hash: chave ? await hashDaChave(chave) : null }).then(
      () => undefined,
      () => undefined,
    );
  }

  // Mesmo registro para a chave da automação (derivada do segredo da Shopee). Falha silenciosa sem a migração 0006.
  if (admin) {
    const chaveAuto = await chaveDaAutomacao();
    await sb.rpc("sincronizar_chave_automacao", { p_hash: chaveAuto ? await hashDaChaveAutomacao(chaveAuto) : null }).then(
      () => undefined,
      () => undefined,
    );
  }

  // Contador de pedidos novos no menu (fica oculto se a migração 0002 ainda não foi aplicada).
  const { count: novos } = admin
    ? await sb.from("pedidos").select("id", { count: "exact", head: true }).eq("status", "novo")
    : { count: null };

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
          <Link href="/admin" className="font-titulo text-xl font-extrabold">Painel {NOME_SITE}</Link>
          <nav aria-label="Painel" className="flex flex-wrap gap-4 text-sm font-semibold">
            {MENU.map((m) => (
              <Link key={m.href} href={m.href} className="inline-flex items-center gap-1.5 py-1 hover:text-laranja-forte">
                {m.rotulo}
                {m.href === "/admin/pedidos" && !!novos && (
                  <span className="rounded-full bg-laranja-forte px-1.5 text-xs leading-5 text-white" aria-label={`${novos} novos`}>{novos}</span>
                )}
              </Link>
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
