import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImagemProduto } from "@/components/ImagemProduto";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import { IconeEstrela, IconeSaida } from "@/components/site/Icones";
import { INSTAGRAM_URL } from "@/lib/config";
import type { Json } from "@/lib/database.types";
import { formatarNota, formatarVendas } from "@/lib/pedido-opcoes";
import { clientePublico } from "@/lib/supabase/publico";
import { formatarPreco } from "@/lib/texto";
import { F } from "@/lib/marca";

// Página pessoal da cliente: o código na URL é o único "login". Não é indexada e nunca é guardada em cache.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: `Opções separadas ${F.pela}`,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Opcao = { id: string; rotulo: string; nome: string; imagem_url: string | null; preco: number | null; nota: number | null; vendas: number | null; loja: string | null };
type PedidoPublico = { nome: string; descricao: string; opcoes: Opcao[] };

async function carregar(token: string): Promise<PedidoPublico | null> {
  const sb = clientePublico();
  if (!sb) return null;
  const { data, error } = await sb.rpc("pedido_publico", { p_token: token });
  if (error || !data) return null;
  return data as unknown as PedidoPublico & Json;
}

export default async function PaginaPedido({ params }: { params: Promise<{ token: string }> }) {
  const pedido = await carregar((await params).token);
  if (!pedido) notFound();
  const { opcoes } = pedido;

  return (
    <>
      <Cabecalho
        titulo={`Oi, ${pedido.nome}! Separei isto pra você`}
        subtitulo={`Você pediu: “${pedido.descricao.length > 140 ? pedido.descricao.slice(0, 139).trimEnd() + "…" : pedido.descricao}”`}
      />
      <Conteudo>
        {opcoes.length === 0 ? (
          <div className="rounded-3xl border-[2.5px] border-tinta bg-pessego p-6">
            <p className="text-lg font-semibold">{F.A} ainda não separou opções para este pedido.</p>
            <p className="mt-1">
              Volte em instantes ou chame {F.a} no{" "}
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener" className="font-bold underline decoration-neon decoration-2">Instagram</a>.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-6 max-w-[60ch] text-lg">Escolha a que mais gostar. Cada uma abre na Shopee, onde você confere fotos, avaliações, frete e o preço final.</p>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {opcoes.map((o) => (
                <li key={o.id} className="vm-cartao flex flex-col gap-3 rounded-3xl border-[2.5px] border-tinta bg-white p-3">
                  <p className="inline-flex items-center gap-1.5 self-start rounded-full border-2 border-tinta bg-sol px-3 py-1 text-sm font-extrabold">
                    <IconeEstrela tamanho={14} />
                    {o.rotulo}
                  </p>
                  <div className="overflow-hidden rounded-2xl border-2 border-pessego bg-white">
                    <ImagemProduto url={o.imagem_url} nome={o.nome} />
                  </div>
                  <h2 className="line-clamp-3 min-h-[3.9em] text-[16px] leading-snug font-semibold">{o.nome}</h2>
                  <p className="text-sm font-semibold text-cinza">
                    {[o.nota !== null ? `★ ${formatarNota(o.nota)}` : null, o.vendas ? formatarVendas(o.vendas) : null, o.loja].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-auto flex flex-col gap-3">
                    {o.preco !== null && (
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-bold text-cinza">a partir de</span>
                        <p className="preco text-3xl font-extrabold">{formatarPreco(o.preco)}</p>
                      </div>
                    )}
                    <a
                      href={`/pedido/ir/${o.id}`}
                      target="_blank"
                      rel="nofollow sponsored noopener noreferrer"
                      className="vm-btn vm-pilula min-h-[56px] w-full bg-neon text-lg font-extrabold text-tinta shadow-duro-p"
                    >
                      Ver na Shopee
                      <IconeSaida />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-8 max-w-[70ch] text-sm text-cinza">
          Os links são de afiliado: se você comprar, {F.a} pode receber uma comissão da Shopee, sem custo extra para você. Preço, variações, frete e estoque
          mudam; vale o que aparece na Shopee na hora da compra. Esta página é só sua: não compartilhe o endereço com quem você não quer que veja o seu pedido.{" "}
          <Link href="/privacidade" className="text-tinta underline decoration-neon decoration-2">Política de privacidade</Link>
        </p>
      </Conteudo>
    </>
  );
}
