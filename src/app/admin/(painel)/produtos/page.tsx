import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/components/admin/Aviso";
import type { StatusPublicacao } from "@/lib/database.types";
import { clienteServidor } from "@/lib/supabase/servidor";
import { escaparBusca, formatarDataHora, formatarPreco } from "@/lib/texto";
import { alterarStatus } from "../../acoes";

export const metadata: Metadata = { title: "Produtos" };

const POR_PAGINA = 50;
const ROTULO: Record<StatusPublicacao, string> = { rascunho: "Rascunho", publicado: "Publicado", despublicado: "Despublicado" };
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PaginaProdutos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = await searchParams;
  const busca = um(parametros.q).trim().slice(0, 80);
  const status = um(parametros.status);
  const pagina = Math.max(1, Number.parseInt(um(parametros.pagina), 10) || 1);

  const sb = await clienteServidor();
  let q = sb
    .from("produtos")
    .select("id, nome, slug, preco_atual, desconto_percentual, status_publicacao, ficticio, origem, atualizado_em", { count: "exact" })
    .order("atualizado_em", { ascending: false });
  if (busca) q = q.ilike("nome", `%${escaparBusca(busca)}%`);
  if (status in ROTULO) q = q.eq("status_publicacao", status as StatusPublicacao);
  const { data, error, count } = await q.range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  const produtos = data ?? [];
  const paginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));
  const linkPagina = (n: number) => {
    const qs = new URLSearchParams();
    if (busca) qs.set("q", busca);
    if (status) qs.set("status", status);
    if (n > 1) qs.set("pagina", String(n));
    return `/admin/produtos?${qs}`;
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-titulo text-3xl font-extrabold">Produtos</h1>
        <div className="flex gap-2">
          <Link href="/admin/importar" className="botao-secundario">Importar CSV</Link>
          <Link href="/admin/produtos/novo" className="botao">Cadastrar produto</Link>
        </div>
      </div>
      <Aviso parametros={parametros} />
      {error && error.code !== "PGRST103" && (
        <p role="alert" className="mb-4 rounded-md border border-laranja bg-laranja-claro p-3 text-sm">Não foi possível listar os produtos: {error.message}</p>
      )}

      <form className="mb-4 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">Buscar por nome</label>
        <input id="q" name="q" type="search" defaultValue={busca} placeholder="Buscar por nome" className="campo max-w-xs py-2" />
        <label htmlFor="status" className="sr-only">Situação</label>
        <select id="status" name="status" defaultValue={status} className="campo w-auto py-2">
          <option value="">Todas as situações</option>
          {Object.entries(ROTULO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
        <button type="submit" className="botao-secundario">Filtrar</button>
      </form>

      {produtos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-linha bg-white p-8 text-center">
          {busca || status ? "Nenhum produto com esse filtro." : "Nenhum produto cadastrado. Cadastre o primeiro ou importe um arquivo CSV."}
        </p>
      ) : (
        <ul className="divide-y divide-linha rounded-lg border border-linha bg-white">
          {produtos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
              <div className="min-w-0 flex-1 basis-64">
                <Link href={`/admin/produtos/${p.id}`} className="font-semibold underline">{p.nome}</Link>
                <p className="text-sm text-cinza">
                  {ROTULO[p.status_publicacao]}, origem {p.origem}, alterado em {formatarDataHora(p.atualizado_em)}
                  {p.ficticio && <strong className="text-tinta"> (dado fictício)</strong>}
                </p>
              </div>
              <p className="preco font-bold">
                {formatarPreco(p.preco_atual)}
                {p.desconto_percentual !== null && <span className="ml-2 text-sm text-laranja-forte">-{p.desconto_percentual}%</span>}
              </p>
              <form action={alterarStatus}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="status" value={p.status_publicacao === "publicado" ? "despublicado" : "publicado"} />
                <button type="submit" className="botao-secundario w-32 py-1.5">{p.status_publicacao === "publicado" ? "Despublicar" : "Publicar"}</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {paginas > 1 && (
        <nav aria-label="Paginação" className="mt-4 flex items-center justify-between text-sm">
          {pagina > 1 ? <Link href={linkPagina(pagina - 1)} className="botao-secundario">Página anterior</Link> : <span />}
          <span className="text-cinza">Página {pagina} de {paginas}</span>
          {pagina < paginas ? <Link href={linkPagina(pagina + 1)} className="botao-secundario">Próxima página</Link> : <span />}
        </nav>
      )}
    </>
  );
}
