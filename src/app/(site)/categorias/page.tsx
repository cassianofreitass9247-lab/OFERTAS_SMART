import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import { IconeCategoria, IconeSeta } from "@/components/site/Icones";
import { listarCategorias } from "@/lib/dados";

// Dados ao vivo: a página é montada a cada acesso (não é gerada no build).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Categorias", description: "Achadinhos da Shopee organizados por categoria.", alternates: { canonical: "/categorias" } };

const CORES = ["bg-neon", "bg-sol", "bg-pessego", "bg-white"];

export default async function PaginaCategorias() {
  const categorias = await listarCategorias();
  return (
    <>
      <Cabecalho titulo="Categorias" subtitulo="Escolha por onde começar o garimpo." />
      <Conteudo>
        {categorias.length === 0 ? (
          <p className="rounded-3xl border-[2.5px] border-dashed border-tinta bg-pessego p-10 text-center font-titulo text-xl font-bold">
            Nenhuma categoria cadastrada ainda.
          </p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categorias.map((c, i) => (
              <li key={c.id}>
                <Link
                  href={`/categorias/${c.slug}`}
                  className={`vm-cartao flex h-full items-center gap-4 rounded-3xl border-[3px] border-tinta p-5 text-tinta no-underline shadow-duro-p ${CORES[i % CORES.length]}`}
                >
                  <span className="flex size-14 flex-none items-center justify-center rounded-2xl border-[2.5px] border-tinta bg-white">
                    <IconeCategoria slug={c.slug} tamanho={28} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-titulo text-2xl font-extrabold tracking-[-0.02em]">{c.nome}</span>
                    {c.descricao && <span className="mt-1 block text-sm font-medium">{c.descricao}</span>}
                  </span>
                  <IconeSeta />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Conteudo>
    </>
  );
}
