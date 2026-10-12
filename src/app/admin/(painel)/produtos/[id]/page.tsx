import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/admin/Aviso";
import { FormularioProduto } from "@/components/admin/FormularioProduto";
import { SITE_URL } from "@/lib/config";
import { clienteServidor } from "@/lib/supabase/servidor";
import { EH_UUID, formatarDataHora, formatarPreco } from "@/lib/texto";
import { excluirProduto } from "../../../acoes";

export const metadata: Metadata = { title: "Editar produto" };

const CAMPOS: Record<string, string> = {
  nome: "Nome", descricao: "Descrição", imagem_url: "Imagem", imagens: "Fotos adicionais", categoria_id: "Categoria", preco_atual: "Preço",
  link_afiliado: "Link de afiliado", disponibilidade: "Disponibilidade", status_publicacao: "Situação", destaque: "Destaque",
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PaginaEditarProduto({ params, searchParams }: Props) {
  const { id } = await params;
  if (!EH_UUID.test(id)) notFound();

  const sb = await clienteServidor();
  const [{ data: produto }, { data: categorias }, { data: precos }, { data: alteracoes }, { count: cliques }] = await Promise.all([
    sb.from("produtos").select("*").eq("id", id).maybeSingle(),
    sb.from("categorias").select("id, nome").order("nome"),
    sb.from("historico_precos").select("*").eq("produto_id", id).order("registrado_em", { ascending: false }).limit(20),
    sb.from("historico_alteracoes").select("*").eq("produto_id", id).order("alterado_em", { ascending: false }).limit(30),
    sb.from("cliques").select("id", { count: "exact", head: true }).eq("produto_id", id),
  ]);
  if (!produto) notFound();

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/produtos" className="underline">Voltar para a lista de produtos</Link></p>
      <h1 className="mb-1 font-titulo text-3xl font-extrabold">Editar produto</h1>
      <p className="mb-4 text-sm text-cinza">
        Origem: {produto.origem}. Cliques registrados: {cliques ?? 0}.{" "}
        {produto.status_publicacao === "publicado" && <Link href={`/produto/${produto.slug}`} className="underline">Ver no site</Link>}
      </p>
      <Aviso parametros={await searchParams} />

      {produto.ficticio && (
        <p className="mb-4 rounded-md bg-tinta p-3 text-sm font-semibold text-white">Dado fictício de demonstração. Não tem botão de compra no site.</p>
      )}
      {produto.preco_anterior !== null && (
        <p className="mb-4 rounded-md border border-linha bg-white p-3 text-sm">
          Desconto exibido no site: de {formatarPreco(produto.preco_anterior)} por {formatarPreco(produto.preco_atual)} (-{produto.desconto_percentual}%),
          com base no preço registrado em {produto.preco_anterior_em && formatarDataHora(produto.preco_anterior_em)}.
        </p>
      )}

      <FormularioProduto produto={produto} categorias={categorias ?? []} />

      {!produto.ficticio && (
        <section className="mt-10 max-w-2xl" aria-labelledby="t-divulgar">
          <h2 id="t-divulgar" className="mb-2 font-titulo text-lg font-bold">Link para divulgar</h2>
          <p className="text-sm text-cinza">Use este endereço nas redes para o site contar os cliques. Troque “telegram” pelo nome do canal.</p>
          <p className="mt-2 rounded-md border border-linha bg-white p-3 font-mono text-sm break-all select-all">{SITE_URL}/ir/{produto.id}?canal=telegram</p>
        </section>
      )}

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section aria-labelledby="t-precos">
          <h2 id="t-precos" className="mb-2 font-titulo text-lg font-bold">Histórico de preços</h2>
          <ul className="divide-y divide-linha rounded-lg border border-linha bg-white text-sm">
            {(precos ?? []).map((h) => (
              <li key={h.id} className="flex justify-between gap-3 p-3">
                <span className="text-cinza">{formatarDataHora(h.registrado_em)}</span>
                <span className="preco font-bold">{formatarPreco(h.preco)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="t-alteracoes">
          <h2 id="t-alteracoes" className="mb-2 font-titulo text-lg font-bold">Histórico de alterações</h2>
          {alteracoes && alteracoes.length > 0 ? (
            <ul className="divide-y divide-linha rounded-lg border border-linha bg-white text-sm">
              {alteracoes.map((a) => (
                <li key={a.id} className="p-3">
                  <span className="text-cinza">{formatarDataHora(a.alterado_em)}:</span> {CAMPOS[a.campo] ?? a.campo} mudou de{" "}
                  <span className="break-all">“{(a.valor_antigo ?? "vazio").slice(0, 80)}”</span> para{" "}
                  <span className="break-all">“{(a.valor_novo ?? "vazio").slice(0, 80)}”</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-linha bg-white p-4 text-sm text-cinza">Nenhuma alteração desde o cadastro.</p>
          )}
        </section>
      </div>

      <section className="mt-10 max-w-2xl rounded-lg border border-linha bg-white p-4" aria-labelledby="t-excluir">
        <h2 id="t-excluir" className="font-titulo text-lg font-bold">Excluir produto</h2>
        <p className="mt-1 mb-3 text-sm text-cinza">Apaga o produto, os históricos e os cliques dele. Não dá para desfazer. Para só tirar do site, use “Despublicado”.</p>
        <form action={excluirProduto} className="flex flex-wrap items-center gap-4">
          <input type="hidden" name="id" value={produto.id} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirmar" required className="size-4" />
            Entendo que a exclusão é definitiva
          </label>
          <button type="submit" className="botao-secundario">Excluir produto</button>
        </form>
      </section>
    </>
  );
}
