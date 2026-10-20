import Link from "next/link";
import { categoriasComCupom, listarCategorias, listarCuponsOuNada, listarProdutos, ORDENACOES, POR_PAGINA, type Filtros, type Ordenacao } from "@/lib/dados";
import { formatarPreco } from "@/lib/texto";
import { GradeProdutos } from "./CartaoProduto";
import { F } from "@/lib/marca";

type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type Props = {
  caminho: string;
  parametros: Busca;
  fixos?: Pick<Filtros, "categoriaId" | "soPromocoes" | "soDestaques">;
  vazio: string;
};

/** Lista paginada com busca, preço máximo e ordenação por links (funciona sem JavaScript). */
export async function ListaOfertas({ caminho, parametros, fixos, vazio }: Props) {
  const busca = um(parametros.q).trim().slice(0, 80);
  const ordenar = (um(parametros.ordenar) in ORDENACOES ? um(parametros.ordenar) : "recentes") as Ordenacao;
  const pagina = Math.min(500, Math.max(1, Number.parseInt(um(parametros.pagina), 10) || 1));
  const ate = Math.min(100000, Math.max(0, Number.parseInt(um(parametros.ate), 10) || 0));

  const [{ itens, total }, categorias, cupons] = await Promise.all([
    listarProdutos({ ...fixos, busca, ordenar, pagina, precoMax: ate || undefined }),
    listarCategorias(),
    listarCuponsOuNada(),
  ]);
  const nomes = new Map(categorias.map((c) => [c.id, c.nome]));
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const link = (mudancas: Record<string, string | number>) => {
    const qs = new URLSearchParams();
    const estado: Record<string, string | number> = { q: busca, ordenar, pagina, ate, ...mudancas };
    if (estado.q) qs.set("q", String(estado.q));
    if (estado.ordenar !== "recentes") qs.set("ordenar", String(estado.ordenar));
    if (Number(estado.ate) > 0) qs.set("ate", String(estado.ate));
    if (Number(estado.pagina) > 1) qs.set("pagina", String(estado.pagina));
    const s = qs.toString();
    return s ? `${caminho}?${s}` : caminho;
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-semibold text-cinza" aria-live="polite">
          {total === 1 ? "1 oferta" : `${total} ofertas`}
          {ate > 0 && <> até {formatarPreco(ate)}</>}
          {busca && <> para “{busca}”</>}
          {(busca || ate > 0) && (
            <>
              {". "}
              <Link href={link({ q: "", ate: 0, pagina: 1 })} className="text-tinta underline decoration-neon decoration-2">
                Limpar filtros
              </Link>
            </>
          )}
        </p>
        <nav aria-label="Ordenar ofertas" className="flex flex-wrap gap-2 text-sm">
          {(Object.keys(ORDENACOES) as Ordenacao[]).map((o) => (
            <Link
              key={o}
              href={link({ ordenar: o, pagina: 1 })}
              aria-current={o === ordenar ? "true" : undefined}
              className={`vm-btn inline-flex min-h-11 items-center rounded-full border-[2.5px] border-tinta px-4 font-bold ${o === ordenar ? "bg-tinta text-white" : "bg-white text-tinta"}`}
            >
              {ORDENACOES[o]}
            </Link>
          ))}
        </nav>
      </div>

      {itens.length === 0 ? (
        <div className="rounded-3xl border-[2.5px] border-dashed border-tinta bg-pessego p-10 text-center">
          <p className="font-titulo text-xl font-bold">{busca ? `Nenhuma oferta encontrada para “${busca}”.` : vazio}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {(busca || ate > 0 || pagina > 1) && (
              <Link href={caminho} className="vm-btn vm-pilula bg-white">
                Ver todas as ofertas desta página
              </Link>
            )}
            {busca && (
              <Link href={`/pedir?q=${encodeURIComponent(busca)}`} className="vm-btn vm-pilula bg-neon font-extrabold">
                Pedir “{busca}” {F.pra}
              </Link>
            )}
          </div>
        </div>
      ) : (
        <GradeProdutos produtos={itens} nomesCategorias={nomes} comCupom={categoriasComCupom(cupons)} />
      )}

      {paginas > 1 && (
        <nav aria-label="Paginação" className="mt-8 flex items-center justify-between gap-3 text-sm">
          {pagina > 1 ? (
            <Link href={link({ pagina: pagina - 1 })} rel="prev" className="vm-btn vm-pilula bg-white">
              Página anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="font-semibold text-cinza">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas ? (
            <Link href={link({ pagina: pagina + 1 })} rel="next" className="vm-btn vm-pilula bg-tinta text-white">
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
