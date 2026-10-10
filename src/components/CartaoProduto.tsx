import Link from "next/link";
import type { ProdutoCartao } from "@/lib/dados";
import { ImagemProduto } from "./ImagemProduto";
import { Preco } from "./Preco";

export function CartaoProduto({ produto, categoria }: { produto: ProdutoCartao; categoria?: string }) {
  return (
    <li className="relative flex flex-col overflow-hidden rounded-lg border border-linha bg-white focus-within:border-laranja hover:border-cinza">
      <ImagemProduto url={produto.imagem_url} nome={produto.nome} />
      <div className="flex flex-1 flex-col gap-2 p-3">
        {produto.ficticio && (
          <p className="self-start rounded bg-tinta px-1.5 py-0.5 text-xs font-semibold text-white">Demonstração: dado fictício</p>
        )}
        {categoria && <p className="text-xs text-cinza">{categoria}</p>}
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">
          <Link href={`/produto/${produto.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {produto.nome}
          </Link>
        </h3>
        <div className="mt-auto pt-1">
          <Preco atual={produto.preco_atual} anterior={produto.preco_anterior} desconto={produto.desconto_percentual} />
        </div>
        {produto.disponibilidade === "indisponivel" && <p className="text-xs font-semibold text-cinza">Indisponível na última verificação</p>}
      </div>
    </li>
  );
}

export function GradeProdutos({ produtos, nomesCategorias }: { produtos: ProdutoCartao[]; nomesCategorias?: Map<string, string> }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {produtos.map((p) => (
        <CartaoProduto key={p.id} produto={p} categoria={p.categoria_id ? nomesCategorias?.get(p.categoria_id) : undefined} />
      ))}
    </ul>
  );
}
