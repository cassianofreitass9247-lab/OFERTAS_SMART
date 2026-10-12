/* eslint-disable @next/next/no-img-element -- foto local, sem otimizador pago */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImagemProduto } from "@/components/ImagemProduto";
import { Preco, SeloDesconto } from "@/components/Preco";
import { IconeSaida } from "@/components/site/Icones";
import { BotaoSalvar } from "@/components/site/Salvos";
import { VideoProduto } from "@/components/site/VideoProduto";
import { historicoDePrecos, listarCategorias, obterProduto } from "@/lib/dados";
import { formatarData, formatarDataHora, formatarPreco } from "@/lib/texto";
import { analisarVideo } from "@/lib/video";

// Dados ao vivo: a página é montada a cada acesso (não é gerada no build).
export const dynamic = "force-dynamic";

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
  const desconto = produto.preco_anterior !== null && produto.desconto_percentual ? produto.desconto_percentual : null;
  const video = analisarVideo(produto.video_url);

  return (
    <article className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:py-12">
      <nav aria-label="Você está em" className="mb-6 flex flex-wrap gap-2 text-sm font-semibold">
        <Link href="/ofertas" className="rounded-full border-2 border-tinta bg-white px-3 py-1 text-tinta no-underline">Ofertas</Link>
        {categoria && (
          <Link href={`/categorias/${categoria.slug}`} className="rounded-full border-2 border-tinta bg-white px-3 py-1 text-tinta no-underline">
            {categoria.nome}
          </Link>
        )}
      </nav>

      {produto.ficticio && (
        <p role="note" className="mb-6 rounded-2xl bg-tinta p-4 font-bold text-white">
          Este é um produto fictício, criado apenas para demonstrar o site. Ele não existe e não está à venda.
        </p>
      )}

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="flex flex-col gap-7 self-start">
        <div className="relative rounded-[30px] border-[3px] border-tinta bg-pessego p-4 shadow-duro">
          <div className="overflow-hidden rounded-[22px] border-2 border-tinta bg-white">
            <ImagemProduto url={produto.imagem_url} nome={produto.nome} prioridade />
          </div>
          {desconto && (
            <span className="absolute -top-5 -right-4">
              <SeloDesconto desconto={desconto} grande />
            </span>
          )}
        </div>
        {video && <VideoProduto video={video} nome={produto.nome} imagem={produto.imagem_url} />}
        </div>

        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-titulo text-3xl leading-tight font-extrabold tracking-[-0.03em] sm:text-4xl">{produto.nome}</h1>
            <BotaoSalvar id={produto.id} nome={produto.nome} grande />
          </div>

          <div className="mt-6">
            <Preco atual={produto.preco_atual} anterior={produto.preco_anterior} desconto={produto.desconto_percentual} grande />
          </div>
          <p className="mt-2 text-sm text-cinza">
            Preço registrado em {formatarDataHora(produto.preco_atualizado_em)}.
            {produto.preco_anterior !== null && produto.preco_anterior_em && (
              <> O valor riscado é o preço que o site havia registrado em {formatarData(produto.preco_anterior_em)}.</>
            )}
          </p>

          <div className="mt-7">
            {produto.ficticio ? (
              <p className="rounded-2xl border-[2.5px] border-tinta bg-white p-4 text-sm font-semibold">Sem link de compra: produto de demonstração.</p>
            ) : (
              <>
                {indisponivel && <p className="mb-3 text-sm font-bold">Na última verificação este produto estava indisponível.</p>}
                <a
                  href={`/ir/${produto.id}`}
                  target="_blank"
                  rel="nofollow sponsored noopener"
                  className="vm-btn vm-pilula min-h-[60px] w-full bg-neon px-8 text-lg font-extrabold text-tinta shadow-duro-p sm:w-auto"
                >
                  Ver preço atual na Shopee
                  <IconeSaida />
                </a>
                <p className="mt-4 max-w-[60ch] text-sm text-cinza">
                  Link de afiliado: se você comprar, posso receber uma comissão, sem custo extra para você. Confira o preço final na Shopee, pois ele pode
                  ter mudado desde o último registro.
                </p>
              </>
            )}
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-2xl border-[2.5px] border-tinta bg-pessego p-3">
            <img src="/moni.jpg" alt="" width={48} height={48} className="size-12 flex-none rounded-full border-2 border-tinta object-cover object-[center_15%]" />
            <p className="text-[15px] font-semibold">
              Achadinho garimpado pela Moni.{" "}
              <Link href="/#moni" className="text-tinta underline decoration-neon decoration-2">Quem é a Moni</Link>
            </p>
          </div>

          {produto.descricao && (
            <section className="mt-9" aria-labelledby="t-descricao">
              <h2 id="t-descricao" className="mb-2 font-titulo text-xl font-bold">Sobre o produto</h2>
              <p className="max-w-[70ch] text-lg leading-relaxed whitespace-pre-line">{produto.descricao}</p>
            </section>
          )}

          {historico.length > 0 && (
            <section className="mt-9" aria-labelledby="t-historico">
              <h2 id="t-historico" className="mb-3 font-titulo text-xl font-bold">Preços registrados pelo site</h2>
              <table className="w-full max-w-sm overflow-hidden rounded-2xl border-[2.5px] border-tinta bg-white text-sm">
                <thead className="sr-only">
                  <tr><th>Data</th><th>Preço</th></tr>
                </thead>
                <tbody>
                  {historico.map((h) => (
                    <tr key={h.id} className="border-b-2 border-pessego last:border-0">
                      <td className="px-4 py-2.5 text-cinza">{formatarDataHora(h.registrado_em)}</td>
                      <td className="preco px-4 py-2.5 text-right text-base font-extrabold">{formatarPreco(h.preco)}</td>
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
