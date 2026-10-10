import Link from "next/link";
import { GradeProdutos } from "@/components/CartaoProduto";
import { listarCategorias, listarProdutos } from "@/lib/dados";

export const revalidate = 300;

export default async function PaginaInicial() {
  const [categorias, destaques, promocoes, recentes] = await Promise.all([
    listarCategorias(),
    listarProdutos({ soDestaques: true, limite: 4 }),
    listarProdutos({ soPromocoes: true, ordenar: "maior-desconto", limite: 8 }),
    listarProdutos({ limite: 12 }),
  ]);
  const nomes = new Map(categorias.map((c) => [c.id, c.nome]));

  return (
    <div className="space-y-10">
      <section className="max-w-3xl pt-2">
        <h1 className="font-titulo text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">
          Ofertas da Shopee com o preço que a gente registrou.
        </h1>
        <p className="mt-3 max-w-[60ch] text-lg text-cinza">
          Aqui o desconto não é promessa de vitrine: o “de/por” só aparece quando o próprio site viu o preço cair.
        </p>
      </section>

      {categorias.length > 0 && (
        <nav aria-label="Categorias" className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <Link key={c.id} href={`/categorias/${c.slug}`} className="rounded-full border border-linha bg-white px-3.5 py-1.5 text-sm font-medium hover:border-cinza">
              {c.nome}
            </Link>
          ))}
        </nav>
      )}

      {destaques.itens.length > 0 && (
        <section aria-labelledby="t-destaques">
          <h2 id="t-destaques" className="mb-3 font-titulo text-2xl font-bold">Em destaque</h2>
          <GradeProdutos produtos={destaques.itens} nomesCategorias={nomes} />
        </section>
      )}

      {promocoes.itens.length > 0 && (
        <section aria-labelledby="t-promocoes">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="t-promocoes" className="font-titulo text-2xl font-bold">Preço caiu</h2>
            <Link href="/promocoes" className="text-sm font-semibold text-laranja-forte underline">Ver todas as promoções</Link>
          </div>
          <GradeProdutos produtos={promocoes.itens} nomesCategorias={nomes} />
        </section>
      )}

      <section aria-labelledby="t-recentes">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="t-recentes" className="font-titulo text-2xl font-bold">Adicionadas há pouco</h2>
          {recentes.total > recentes.itens.length && (
            <Link href="/ofertas" className="text-sm font-semibold text-laranja-forte underline">Ver todas as ofertas</Link>
          )}
        </div>
        {recentes.itens.length > 0 ? (
          <GradeProdutos produtos={recentes.itens} nomesCategorias={nomes} />
        ) : (
          <p className="rounded-lg border border-dashed border-linha bg-white p-8 text-center">Ainda não há ofertas publicadas. Volte em breve.</p>
        )}
      </section>
    </div>
  );
}
