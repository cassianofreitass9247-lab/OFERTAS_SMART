import Link from "next/link";
import type { ProdutoCartao } from "@/lib/dados";
import { ImagemProduto } from "./ImagemProduto";
import { Preco, SeloDesconto } from "./Preco";
import { BotaoSalvar } from "./site/Salvos";

const FUNDOS = ["bg-pessego", "bg-[#fff3b8]", "bg-[#ffe0ea]", "bg-[#e2f0ff]"];
const fundo = (id: string) => FUNDOS[id.charCodeAt(0) % FUNDOS.length];

export function CartaoProduto({ produto, categoria, comCupom = false }: { produto: ProdutoCartao; categoria?: string; comCupom?: boolean }) {
  const desconto = produto.preco_anterior !== null && produto.desconto_percentual ? produto.desconto_percentual : null;
  return (
    <li className="vm-cartao relative flex flex-col gap-2.5 rounded-3xl border-[2.5px] border-tinta bg-white p-3">
      <div className={`relative overflow-hidden rounded-2xl ${produto.imagem_url ? "bg-white" : fundo(produto.id)}`}>
        <ImagemProduto url={produto.imagem_url} nome={produto.nome} />
        {desconto && (
          <span className="absolute top-2.5 left-2.5">
            <SeloDesconto desconto={desconto} />
          </span>
        )}
        <span className="absolute top-2 right-2 z-10">
          <BotaoSalvar id={produto.id} nome={produto.nome} />
        </span>
      </div>
      {produto.ficticio && (
        <p className="self-start rounded-md bg-tinta px-2 py-0.5 text-xs font-bold text-white">Demonstração: dado fictício</p>
      )}
      {categoria && <p className="text-[13px] font-bold text-cinza">{categoria}</p>}
      {comCupom && (
        <Link
          href="/cupons"
          className="relative z-10 self-start rounded-full border-2 border-tinta bg-sol px-2.5 py-0.5 text-xs font-extrabold text-tinta no-underline"
        >
          Cupom disponível
        </Link>
      )}
      <h3 className="line-clamp-2 min-h-[2.6em] text-[15px] leading-snug font-semibold">
        <Link href={`/produto/${produto.slug}`} className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none">
          {produto.nome}
        </Link>
      </h3>
      <div className="mt-auto">
        <Preco atual={produto.preco_atual} anterior={produto.preco_anterior} desconto={produto.desconto_percentual} />
      </div>
      {produto.disponibilidade === "indisponivel" && <p className="text-xs font-bold text-cinza">Indisponível na última verificação</p>}
    </li>
  );
}

export function GradeProdutos({
  produtos,
  nomesCategorias,
  colunas = "auto",
  comCupom,
}: {
  produtos: ProdutoCartao[];
  nomesCategorias?: Map<string, string>;
  colunas?: "auto" | "duas";
  /** Categorias com cupom vigente: os produtos delas ganham o selo "Cupom disponível". */
  comCupom?: Set<string>;
}) {
  const classe =
    colunas === "duas" ? "grid grid-cols-2 gap-3 sm:gap-5" : "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4";
  return (
    <ul className={classe}>
      {produtos.map((p) => (
        <CartaoProduto
          key={p.id}
          produto={p}
          categoria={p.categoria_id ? nomesCategorias?.get(p.categoria_id) : undefined}
          comCupom={!!p.categoria_id && !!comCupom?.has(p.categoria_id)}
        />
      ))}
    </ul>
  );
}
