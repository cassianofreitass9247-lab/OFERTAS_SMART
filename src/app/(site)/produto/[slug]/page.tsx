import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImagemProduto } from "@/components/ImagemProduto";
import { Preco } from "@/components/Preco";
import { historicoDePrecos, listarCategorias, obterProduto } from "@/lib/dados";
import { formatarData, formatarDataHora, formatarPreco } from "@/lib/texto";

export const revalidate = 300;

// Páginas de produto são geradas no primeiro acesso e ficam em cache por 5 minutos.
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const produto = await obterProduto((await params).slug);
  if (!produto) return { title: "Oferta não encontrada" };
  return {
    title: produto.nome,
    description: (produto.descricao ?? `${produto.nome} por ${formatarPreco(produto.preco_atual)} na Shopee.`).slice(0, 160),
    alternates: { canonical: `/produto/${produto.slug}` },
    robots: produto.ficticio ? { index: false, follow: false } : undefined,
    openGraph: { title: produto.nome, images: produto.imagem_url ? [produto.imagem_url] : undefined },
  };
}

export default async function PaginaProduto({ params }: Props) {
  const produto = await obterProduto((await params).slug);
  if (!produto) notFound();

  const [historico, categorias] = await Promise.all([historicoDePrecos(produto.id), listarCategorias()]);
  const categoria = categorias.find((c) => c.id === produto.categoria_id);
  const indisponivel = produto.disponibilidade === "indisponivel";

  return (
    <article>
      <nav aria-label="Você está em" className="mb-4 text-sm text-cinza">
        <Link href="/ofertas" className="underline">Ofertas</Link>
        {categoria && (
          <>
            {" / "}
            <Link href={`/categorias/${categoria.slug}`} className="underline">{categoria.nome}</Link>
          </>
        )}
      </nav>

      {produto.ficticio && (
        <p role="note" className="mb-4 rounded-lg bg-tinta p-4 font-semibold text-white">
          Este é um produto fictício, criado apenas para demonstrar o site. Ele não existe e não está à venda.
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-linha bg-white">
          <ImagemProduto url={produto.imagem_url} nome={produto.nome} prioridade />
        </div>

        <div>
          <h1 className="font-titulo text-2xl leading-tight font-bold sm:text-3xl">{produto.nome}</h1>

          <div className="mt-5">
            <Preco atual={produto.preco_atual} anterior={produto.preco_anterior} desconto={produto.desconto_percentual} grande />
          </div>
          <p className="mt-2 text-sm text-cinza">
            Preço registrado em {formatarDataHora(produto.preco_atualizado_em)}.
            {produto.preco_anterior !== null && produto.preco_anterior_em && (
              <> O valor riscado é o preço que o site havia registrado em {formatarData(produto.preco_anterior_em)}.</>
            )}
          </p>

          <div className="mt-6">
            {produto.ficticio ? (
              <p className="rounded-md border border-linha bg-white p-3 text-sm">Sem link de compra: produto de demonstração.</p>
            ) : (
              <>
                {indisponivel && <p className="mb-2 text-sm font-semibold">Na última verificação este produto estava indisponível.</p>}
                <a href={`/ir/${produto.id}`} target="_blank" rel="nofollow sponsored noopener" className="botao w-full px-6 py-3.5 text-base sm:w-auto">
                  Ver preço atual na Shopee
                </a>
                <p className="mt-3 max-w-[60ch] text-sm text-cinza">
                  Link de afiliado: se você comprar, o site pode receber uma comissão, sem custo extra para você. Confira o preço final na Shopee, pois ele
                  pode ter mudado desde o nosso último registro.
                </p>
              </>
            )}
          </div>

          {produto.descricao && (
            <section className="mt-8" aria-labelledby="t-descricao">
              <h2 id="t-descricao" className="mb-2 font-titulo text-lg font-bold">Sobre o produto</h2>
              <p className="max-w-[70ch] leading-relaxed whitespace-pre-line">{produto.descricao}</p>
            </section>
          )}

          {historico.length > 0 && (
            <section className="mt-8" aria-labelledby="t-historico">
              <h2 id="t-historico" className="mb-2 font-titulo text-lg font-bold">Preços registrados pelo site</h2>
              <table className="w-full max-w-sm text-sm">
                <thead className="sr-only">
                  <tr><th>Data</th><th>Preço</th></tr>
                </thead>
                <tbody>
                  {historico.map((h) => (
                    <tr key={h.id} className="border-b border-linha last:border-0">
                      <td className="py-2 text-cinza">{formatarDataHora(h.registrado_em)}</td>
                      <td className="preco py-2 text-right font-bold">{formatarPreco(h.preco)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
