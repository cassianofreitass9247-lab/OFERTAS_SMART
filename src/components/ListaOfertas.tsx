import Link from "next/link";
import { listarCategorias, listarProdutos, ORDENACOES, POR_PAGINA, type Filtros, type Ordenacao } from "@/lib/dados";
import { GradeProdutos } from "./CartaoProduto";

type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type Props = {
  caminho: string;
  parametros: Busca;
  fixos?: Pick<Filtros, "categoriaId" | "soPromocoes">;
  vazio: string;
};

/** Lista paginada com busca e ordenação por links (funciona sem JavaScript). */
export async function ListaOfertas({ caminho, parametros, fixos, vazio }: Props) {
  const busca = um(parametros.q).trim().slice(0, 80);
  const ordenar = (um(parametros.ordenar) in ORDENACOES ? um(parametros.ordenar) : "recentes") as Ordenacao;
  const pagina = Math.min(500, Math.max(1, Number.parseInt(um(parametros.pagina), 10) || 1));

  const [{ itens, total }, categorias] = await Promise.all([
    listarProdutos({ ...fixos, busca, ordenar, pagina }),
    listarCategorias(),
  ]);
  const nomes = new Map(categorias.map((c) => [c.id, c.nome]));
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const link = (mudancas: Record<string, string | number>) => {
    const qs = new URLSearchParams();
    const estado: Record<string, string | number> = { q: busca, ordenar, pagina, ...mudancas };
    if (estado.q) qs.set("q", String(estado.q));
    if (estado.ordenar !== "recentes") qs.set("ordenar", String(estado.ordenar));
    if (Number(estado.pagina) > 1) qs.set("pagina", String(estado.pagina));
    const s = qs.toString();
    return s ? `${caminho}?${s}` : caminho;
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-cinza" aria-live="polite">
          {total === 1 ? "1 oferta" : `${total} ofertas`}
          {busca && (
            <>
              {" "}para “{busca}”.{" "}
              <Link href={link({ q: "", pagina: 1 })} className="text-laranja-forte underline">
                Limpar busca
              </Link>
            </>
          )}
        </p>
        <nav aria-label="Ordenar ofertas" className="flex flex-wrap gap-1 text-sm">
          {(Object.keys(ORDENACOES) as Ordenacao[]).map((o) => (
            <Link
              key={o}
              href={link({ ordenar: o, pagina: 1 })}
              aria-current={o === ordenar ? "true" : undefined}
              className={`rounded-full border px-3 py-1.5 ${o === ordenar ? "border-tinta bg-tinta font-semibold text-white" : "border-linha bg-white text-tinta hover:border-cinza"}`}
            >
              {ORDENACOES[o]}
            </Link>
          ))}
        </nav>
      </div>

      {itens.length === 0 ? (
        <div className="rounded-lg border border-dashed border-linha bg-white p-8 text-center">
          <p className="text-tinta">{busca ? `Nenhuma oferta encontrada para “${busca}”.` : vazio}</p>
          {(busca || pagina > 1) && (
            <Link href={caminho} className="botao-secundario mt-4">
              Ver todas as ofertas desta página
            </Link>
          )}
        </div>
      ) : (
        <GradeProdutos produtos={itens} nomesCategorias={nomes} />
      )}

      {paginas > 1 && (
        <nav aria-label="Paginação" className="mt-6 flex items-center justify-between gap-3 text-sm">
          {pagina > 1 ? (
            <Link href={link({ pagina: pagina - 1 })} rel="prev" className="botao-secundario">
              Página anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-cinza">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas ? (
            <Link href={link({ pagina: pagina + 1 })} rel="next" className="botao-secundario">
              Próxima página
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
