import Link from "next/link";
import {
  IconeBusca,
  IconeCategoria,
  IconeEscudo,
  IconeEtiqueta,
  IconeInstagram,
  IconeQueda,
  IconeRelogio,
  IconeSino,
  Marca,
} from "@/components/site/Icones";
import { ContadorSalvos, SalvosProvider } from "@/components/site/Salvos";
import { bancoConfigurado, INSTAGRAM_URL, NOME_SITE, TELEGRAM_URL } from "@/lib/config";
import type { Categoria } from "@/lib/database.types";
import { listarCategorias } from "@/lib/dados";

const MAX_CATEGORIAS_NO_MENU = 8;

async function categoriasDoMenu(): Promise<{ lista: Categoria[]; temMais: boolean }> {
  try {
    const todas = await listarCategorias();
    return { lista: todas.slice(0, MAX_CATEGORIAS_NO_MENU), temMais: todas.length > MAX_CATEGORIAS_NO_MENU };
  } catch {
    return { lista: [], temMais: false }; // o menu não derruba a página se o banco oscilar
  }
}

export default async function LayoutSite({ children }: { children: React.ReactNode }) {
  const { lista: categorias, temMais } = await categoriasDoMenu();
  const chamada = TELEGRAM_URL
    ? { href: TELEGRAM_URL, rotulo: "Receber ofertas", icone: <IconeSino /> }
    : { href: INSTAGRAM_URL, rotulo: "Seguir no Instagram", icone: <IconeInstagram tamanho={18} /> };

  return (
    <SalvosProvider>
      <div className="min-h-screen overflow-x-clip bg-white text-tinta">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:bg-white focus:p-3">
          Pular para o conteúdo
        </a>

        <div className="bg-tinta text-white">
          <p className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-2.5 text-center text-sm font-semibold sm:px-8">
            <span className="inline-flex items-center gap-2">
              <IconeEscudo />
              Só links oficiais da Shopee
            </span>
            <span className="hidden items-center gap-2 md:inline-flex">
              <IconeQueda />
              Desconto só quando o preço cai de verdade
            </span>
            <span className="hidden items-center gap-2 md:inline-flex">
              <IconeRelogio />
              Ofertas novas todo dia
            </span>
          </p>
        </div>

        <header className="sticky top-0 z-50 border-b-[3px] border-tinta bg-neon">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-7 gap-y-3 px-4 pt-3.5 sm:px-8">
            <Link href="/" className="vm-logo flex items-center gap-3 text-tinta no-underline" aria-label={`${NOME_SITE}, página inicial`}>
              <span className="vm-marca block flex-none origin-[50%_90%] drop-shadow-[3px_3px_0_#1e120c]">
                <Marca tamanho={52} />
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-titulo text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">{NOME_SITE}</span>
                <span className="mt-1.5 hidden text-[13px] font-bold sm:block">achadinhos da Shopee garimpados por mim</span>
              </span>
            </Link>

            <form
              action="/ofertas"
              role="search"
              className="vm-busca order-3 flex min-h-[50px] w-full min-w-0 items-center gap-2.5 rounded-full border-[2.5px] border-tinta bg-white py-0 pr-1.5 pl-4 md:order-none md:w-auto md:flex-1"
            >
              <IconeBusca />
              <label htmlFor="busca" className="sr-only">
                Buscar achadinho
              </label>
              <input
                id="busca"
                name="q"
                type="search"
                maxLength={80}
                placeholder="Buscar achadinho: air fryer, fone, bolsa…"
                className="h-11 min-w-0 flex-1 border-0 bg-transparent text-base text-tinta placeholder:text-cinza"
              />
              <button type="submit" className="vm-btn min-h-10 flex-none cursor-pointer rounded-full bg-tinta px-4 text-[15px] font-bold text-white">
                Buscar
              </button>
            </form>

            <div className="ml-auto flex items-center gap-2.5">
              <Link
                href="/#moni"
                className="vm-navlink hidden xl:inline-flex min-h-11 flex-none items-center gap-2.5 rounded-full border-[2.5px] border-tinta bg-white py-0 pr-4 pl-1 text-[15px] font-bold text-tinta no-underline"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/moni.jpg" alt="" width={32} height={32} className="size-8 rounded-full border-2 border-tinta object-cover object-[center_15%]" />
                Quem é a Moni
              </Link>
              <ContadorSalvos />
              <a
                href={chamada.href}
                target="_blank"
                rel="noopener"
                className="vm-btn hidden min-h-[50px] items-center gap-2 rounded-full bg-tinta px-5 font-bold text-white no-underline shadow-branco md:inline-flex"
              >
                {chamada.icone}
                {chamada.rotulo}
              </a>
            </div>

            <nav aria-label="Principal" className="vm-sem-barra vm-nav-fade -mx-1 flex basis-full gap-2 overflow-x-auto px-1 pt-1 pb-3.5 md:flex-wrap md:overflow-visible">
              <Link
                href="/promocoes"
                className="vm-btn inline-flex min-h-11 flex-none items-center gap-2.5 rounded-full border-[2.5px] border-tinta bg-tinta px-4 text-[15px] font-bold text-white no-underline"
              >
                <span className="vm-pulso size-2.5 rounded-full bg-sol" />
                Preço caiu hoje
              </Link>
              {categorias.map((c) => (
                <Link
                  key={c.id}
                  href={`/categorias/${c.slug}`}
                  className="vm-navlink inline-flex min-h-11 flex-none items-center gap-2 rounded-full border-[2.5px] border-tinta bg-white px-4 text-[15px] font-bold text-tinta no-underline"
                >
                  <IconeCategoria slug={c.slug} />
                  {c.nome}
                </Link>
              ))}
              {temMais && (
                <Link
                  href="/categorias"
                  className="vm-navlink inline-flex min-h-11 flex-none items-center gap-2 rounded-full border-[2.5px] border-tinta bg-white px-4 text-[15px] font-bold text-tinta no-underline"
                >
                  Todas as categorias
                </Link>
              )}
              <Link
                href="/ofertas?ate=50"
                className="vm-navlink inline-flex min-h-11 flex-none items-center gap-2 rounded-full border-[2.5px] border-tinta bg-sol px-4 text-[15px] font-extrabold text-tinta no-underline"
              >
                <IconeEtiqueta />
                Até R$ 50
              </Link>
              <Link
                href="/#moni"
                className="vm-navlink inline-flex xl:hidden min-h-11 flex-none items-center gap-2.5 rounded-full border-[2.5px] border-tinta bg-white py-0 pr-4 pl-1 text-[15px] font-bold text-tinta no-underline"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/moni.jpg" alt="" width={32} height={32} className="size-8 rounded-full border-2 border-tinta object-cover object-[center_15%]" />
                Quem é a Moni
              </Link>
            </nav>
          </div>
        </header>

        {!bancoConfigurado() && (
          <p role="status" className="bg-sol px-4 py-3 text-center text-sm font-bold text-tinta">
            Configuração pendente: o banco de dados ainda não foi conectado, por isso nenhuma oferta aparece.
          </p>
        )}

        <main id="conteudo">{children}</main>

        <footer className="bg-tinta text-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-12 sm:px-8">
            <span className="flex items-center gap-3">
              <Marca tamanho={40} />
              <span className="font-titulo text-2xl font-extrabold text-neon">{NOME_SITE}</span>
            </span>
            <p className="max-w-[70ch] text-[15px] leading-relaxed text-[#e8dcd5]">
              Este site usa links de afiliado: se você comprar por um link daqui, posso receber uma comissão da Shopee, sem custo extra para você. Preços,
              condições e estoque podem mudar a qualquer momento; vale sempre o que aparece na Shopee na hora da compra. A {NOME_SITE} é independente e não
              pertence à Shopee.
            </p>
            <nav aria-label="Institucional" className="flex flex-wrap gap-x-6 gap-y-3 text-[15px]">
              <Link href="/afiliados" className="text-white underline">Links de afiliado</Link>
              <Link href="/privacidade" className="text-white underline">Política de privacidade</Link>
              <Link href="/termos" className="text-white underline">Termos de uso</Link>
              <Link href="/contato" className="text-white underline">Contato</Link>
            </nav>
          </div>
        </footer>
      </div>
    </SalvosProvider>
  );
}
