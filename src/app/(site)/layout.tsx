import Link from "next/link";
import { bancoConfigurado, NOME_SITE } from "@/lib/config";

const MENU = [
  { href: "/ofertas", rotulo: "Ofertas" },
  { href: "/promocoes", rotulo: "Promoções" },
  { href: "/categorias", rotulo: "Categorias" },
];

export default function LayoutSite({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">
        Pular para o conteúdo
      </a>
      <header className="border-b border-linha bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/" className="font-titulo text-2xl font-extrabold tracking-tight text-tinta">
            Oferta<span className="text-laranja-forte">Smart</span>
          </Link>
          <form action="/ofertas" role="search" className="order-3 flex w-full gap-2 sm:order-none sm:w-auto sm:flex-1">
            <label htmlFor="busca" className="sr-only">
              Buscar ofertas
            </label>
            <input id="busca" name="q" type="search" maxLength={80} placeholder="Buscar produto" className="campo py-2" />
            <button type="submit" className="botao shrink-0">
              Buscar
            </button>
          </form>
          <nav aria-label="Principal" className="ml-auto flex gap-4 text-sm font-semibold sm:ml-0">
            {MENU.map((m) => (
              <Link key={m.href} href={m.href} className="py-1 text-tinta hover:text-laranja-forte">
                {m.rotulo}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {!bancoConfigurado() && (
        <p role="status" className="bg-tinta px-4 py-3 text-center text-sm text-white">
          Configuração pendente: o banco de dados ainda não foi conectado, por isso nenhuma oferta aparece. Siga o passo a passo do arquivo README.
        </p>
      )}

      <main id="conteudo" className="mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>

      <footer className="mt-10 border-t border-linha bg-white">
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 text-sm text-cinza">
          <p className="max-w-[70ch]">
            <strong className="text-tinta">Este site usa links de afiliado.</strong> Ao comprar por um link do {NOME_SITE}, podemos receber uma comissão da
            Shopee, sem custo adicional para você. Preços, condições e disponibilidade podem mudar a qualquer momento: o valor válido é sempre o exibido na
            Shopee no momento da compra.
          </p>
          <nav aria-label="Institucional" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/afiliados" className="underline">Como funcionam os links de afiliado</Link>
            <Link href="/privacidade" className="underline">Política de privacidade</Link>
            <Link href="/termos" className="underline">Termos de uso</Link>
            <Link href="/contato" className="underline">Contato</Link>
          </nav>
          <p>{NOME_SITE} é um site independente e não pertence à Shopee.</p>
        </div>
      </footer>
    </>
  );
}
