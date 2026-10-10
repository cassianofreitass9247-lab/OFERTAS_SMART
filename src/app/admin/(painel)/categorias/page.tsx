import type { Metadata } from "next";
import { Aviso } from "@/components/admin/Aviso";
import { clienteServidor } from "@/lib/supabase/servidor";
import { alternarCategoria, criarCategoria, excluirCategoria } from "../../acoes";

export const metadata: Metadata = { title: "Categorias" };

export default async function PaginaCategoriasAdmin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sb = await clienteServidor();
  const { data, error } = await sb.from("categorias").select("*").order("nome");
  const categorias = data ?? [];

  return (
    <>
      <h1 className="mb-4 font-titulo text-3xl font-extrabold">Categorias</h1>
      <Aviso parametros={await searchParams} />
      {error && <p role="alert" className="mb-4 rounded-md border border-laranja bg-laranja-claro p-3 text-sm">Não foi possível listar: {error.message}</p>}

      <form action={criarCategoria} className="mb-8 max-w-2xl space-y-4 rounded-lg border border-linha bg-white p-4">
        <h2 className="font-titulo text-lg font-bold">Nova categoria</h2>
        <div>
          <label htmlFor="nome" className="rotulo">Nome</label>
          <input id="nome" name="nome" required minLength={2} maxLength={60} className="campo" />
        </div>
        <div>
          <label htmlFor="descricao" className="rotulo">Descrição (opcional, aparece na página da categoria)</label>
          <textarea id="descricao" name="descricao" rows={2} maxLength={500} className="campo" />
        </div>
        <button type="submit" className="botao">Criar categoria</button>
      </form>

      {categorias.length === 0 ? (
        <p className="rounded-lg border border-dashed border-linha bg-white p-8 text-center">Nenhuma categoria ainda. Crie a primeira acima.</p>
      ) : (
        <ul className="divide-y divide-linha rounded-lg border border-linha bg-white">
          {categorias.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-semibold">{c.nome}</p>
                <p className="text-sm text-cinza">/categorias/{c.slug}, {c.ativa ? "visível no site" : "oculta"}</p>
              </div>
              <form action={alternarCategoria}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="ativa" value={String(!c.ativa)} />
                <button type="submit" className="botao-secundario py-1.5">{c.ativa ? "Ocultar do site" : "Reativar"}</button>
              </form>
              <form action={excluirCategoria}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="text-sm underline">Excluir</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-cinza">Ao excluir uma categoria, os produtos dela continuam cadastrados, apenas ficam sem categoria.</p>
    </>
  );
}
