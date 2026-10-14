import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/components/admin/Aviso";
import { ehOrdemLote, FILTROS_PADRAO, lerFiltro, MAX_LOTE, nomeBloqueado, ORDENS_LOTE, ordenarLocal, ordemParaShopee, passaNosFiltros, type OrdemLote } from "@/lib/lote";
import { buscarVariasPaginas, configShopee, ErroShopee, precoDaOferta, type Oferta } from "@/lib/shopee";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatarPreco } from "@/lib/texto";
import { desfazerLote } from "../../../shopee-lote-acoes";
import { GradeLote, type ItemGrade } from "./GradeLote";

export const metadata: Metadata = { title: "Importar em lote" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PaginaLote({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const cfg = configShopee();
  const buscou = um(p.buscar) === "1";
  const q = um(p.q).trim().slice(0, 100);
  const ordem: OrdemLote = ehOrdemLote(um(p.ordem)) ? (um(p.ordem) as OrdemLote) : "vendas";
  const filtros = {
    vendasMin: lerFiltro(um(p.vendasMin), FILTROS_PADRAO.vendasMin, 10_000_000),
    descontoMin: lerFiltro(um(p.descontoMin), FILTROS_PADRAO.descontoMin, 100),
    comissaoMin: lerFiltro(um(p.comissaoMin), FILTROS_PADRAO.comissaoMin, 100),
    notaMin: lerFiltro(um(p.notaMin), FILTROS_PADRAO.notaMin, 5),
  };
  const de = Math.min(Math.max(Number.parseInt(um(p.de), 10) || 1, 1), 50);

  let itens: ItemGrade[] = [];
  let lidos = 0;
  let proxima: number | null = null;
  let erro: string | undefined;
  let aviso: string | undefined;

  const sb = await clienteServidor();
  if (buscou && cfg.ativo) {
    try {
      const r = await buscarVariasPaginas({ termo: q, ordem: ordemParaShopee(ordem), de });
      lidos = r.ofertas.length;
      proxima = r.proximaPagina;
      aviso = r.aviso;
      const aprovadas: Oferta[] = ordenarLocal(r.ofertas.filter((o) => passaNosFiltros(o, filtros)), ordem).slice(0, MAX_LOTE);
      const { data } = aprovadas.length
        ? await sb.from("produtos").select("id, id_externo").in("id_externo", aprovadas.map((o) => `${o.shopId}.${o.itemId}`))
        : { data: [] };
      const cad = new Map((data ?? []).map((x) => [x.id_externo, x.id]));
      itens = aprovadas
        .filter((o) => o.linkAfiliado && precoDaOferta(o) !== null)
        .map((o) => ({
          itemId: o.itemId,
          shopId: o.shopId,
          nome: o.nome,
          link: o.linkAfiliado as string,
          preco: precoDaOferta(o) as number,
          precoTexto: formatarPreco(precoDaOferta(o) as number),
          imagem: o.imagemUrl,
          loja: o.loja,
          desconto: o.desconto,
          comissao: o.comissao,
          vendas: o.vendas,
          nota: o.nota,
          existente: cad.get(`${o.shopId}.${o.itemId}`) ?? null,
          bloqueado: nomeBloqueado(o.nome),
        }));
    } catch (e) {
      erro = e instanceof ErroShopee ? e.message : "Não foi possível consultar a Shopee agora. Tente de novo em instantes.";
    }
  }

  const { data: categorias } = await sb.from("categorias").select("id, nome").order("nome");

  // Lotes recentes (tolera a migração 0005 ainda não aplicada)
  const { data: lotes, error: erroLotes } = await sb.from("lotes_importacao").select("*").order("criado_em", { ascending: false }).limit(8);
  const contagem = new Map<string, { publicado: number; rascunho: number; despublicado: number }>();
  if (lotes?.length) {
    const { data: prods } = await sb.from("produtos").select("lote_id, status_publicacao").in("lote_id", lotes.map((l) => l.id));
    for (const x of prods ?? []) {
      if (!x.lote_id) continue;
      const c = contagem.get(x.lote_id) ?? { publicado: 0, rascunho: 0, despublicado: 0 };
      c[x.status_publicacao]++;
      contagem.set(x.lote_id, c);
    }
  }

  const params = new URLSearchParams({
    buscar: "1",
    q,
    ordem,
    vendasMin: String(filtros.vendasMin),
    descontoMin: String(filtros.descontoMin),
    comissaoMin: String(filtros.comissaoMin),
    notaMin: String(filtros.notaMin),
  });
  const volta = `/admin/shopee/lote?${params}&de=${de}`;
  const maisHref = proxima ? `/admin/shopee/lote?${params}&de=${proxima}` : null;

  return (
    <>
      <h1 className="mb-1 font-titulo text-3xl font-extrabold">Importar em lote</h1>
      <p className="mb-3 max-w-[75ch] text-sm text-cinza">
        Defina filtros, veja os produtos com foto, marque os que quer (até {MAX_LOTE}) e importe de uma vez. Por padrão os produtos entram <strong>publicados e disponíveis</strong>, com categoria automática.{" "}
        <Link href="/admin/shopee" className="underline">Importar um produto só</Link>
      </p>
      <Aviso parametros={p} />

      {!cfg.ativo && <p role="alert" className="mb-4 rounded-md border border-laranja bg-laranja-claro p-3 text-sm">A integração com a Shopee ainda não está configurada (veja a página &ldquo;Importar da Shopee&rdquo;).</p>}

      <form method="get" action="/admin/shopee/lote" className="mb-6 grid gap-3 rounded-lg border border-linha bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="buscar" value="1" />
        <div className="sm:col-span-2">
          <label htmlFor="q" className="rotulo">Palavra-chave (opcional)</label>
          <input id="q" name="q" defaultValue={q} maxLength={100} placeholder="ex.: air fryer — vazio busca em tudo" className="campo" disabled={!cfg.ativo} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ordem" className="rotulo">Ordem</label>
          <select id="ordem" name="ordem" defaultValue={ordem} className="campo" disabled={!cfg.ativo}>
            {ORDENS_LOTE.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="vendasMin" className="rotulo">Vendas mínimas</label>
          <input id="vendasMin" name="vendasMin" type="number" min={0} defaultValue={filtros.vendasMin} className="campo" disabled={!cfg.ativo} />
        </div>
        <div>
          <label htmlFor="notaMin" className="rotulo">Nota mínima (0–5)</label>
          <input id="notaMin" name="notaMin" type="number" min={0} max={5} step="0.1" defaultValue={filtros.notaMin} className="campo" disabled={!cfg.ativo} />
        </div>
        <div>
          <label htmlFor="descontoMin" className="rotulo">Desconto mínimo (%)</label>
          <input id="descontoMin" name="descontoMin" type="number" min={0} max={100} defaultValue={filtros.descontoMin} className="campo" disabled={!cfg.ativo} />
        </div>
        <div>
          <label htmlFor="comissaoMin" className="rotulo">Comissão mínima (%)</label>
          <input id="comissaoMin" name="comissaoMin" type="number" min={0} max={100} step="0.1" defaultValue={filtros.comissaoMin} className="campo" disabled={!cfg.ativo} />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-4">
          <button type="submit" className="botao" disabled={!cfg.ativo}>Buscar produtos</button>
        </div>
      </form>

      {erro && <p role="alert" className="mb-4 rounded-md border border-laranja bg-laranja-claro p-3 text-sm">{erro}</p>}
      {aviso && <p role="status" className="mb-4 rounded-md border border-linha bg-white p-3 text-sm">{aviso}</p>}

      {buscou && !erro && (
        <section aria-label="Resultado da busca" className="mb-8">
          <p className="mb-3 text-sm text-cinza" data-testid="resumo-busca">
            A Shopee devolveu {lidos} produto(s); {itens.length} passaram nos filtros{itens.length >= MAX_LOTE ? ` (mostrando os ${MAX_LOTE} primeiros)` : ""}.
            {ordem === "desconto" && " A Shopee não ordena por desconto: a ordenação vale só entre os produtos buscados."}
          </p>
          {itens.length === 0 ? (
            <p className="rounded-lg border border-dashed border-linha bg-white p-8 text-center">Nenhum produto passou nos filtros. Afrouxe os filtros ou busque mais.</p>
          ) : (
            <GradeLote
              key={volta}
              itens={itens}
              categorias={categorias ?? []}
              volta={volta}
              max={MAX_LOTE}
              filtros={{ q, ordem, vendas: String(filtros.vendasMin), desconto: String(filtros.descontoMin), comissao: String(filtros.comissaoMin), nota: String(filtros.notaMin) }}
            />
          )}
          {maisHref && <p className="mt-4"><Link href={maisHref} className="botao-secundario">Buscar mais (próximas páginas)</Link></p>}
        </section>
      )}

      <section aria-label="Lotes recentes">
        <h2 className="mb-2 font-titulo text-xl font-extrabold">Lotes recentes</h2>
        {erroLotes ? (
          <p className="rounded-md border border-linha bg-white p-3 text-sm">O histórico de lotes precisa da migração 0005 no Supabase (arquivo <code>supabase/migrations/0005_lotes_de_importacao.sql</code>). Sem ela, a importação em lote não grava.</p>
        ) : !lotes?.length ? (
          <p className="text-sm text-cinza">Nenhum lote ainda.</p>
        ) : (
          <ul className="space-y-2">
            {lotes.map((l) => {
              const c = contagem.get(l.id) ?? { publicado: 0, rascunho: 0, despublicado: 0 };
              const ativos = c.publicado + c.rascunho;
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-linha bg-white p-3 text-sm">
                  <span className="min-w-[12rem] flex-1">
                    {new Date(l.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })} ·{" "}
                    {l.automatico ? "automático" : l.publicado_direto ? "publicados direto" : "rascunhos"} · {l.total} produto(s)
                    <span className="block text-xs text-cinza">
                      Hoje: {c.publicado} no ar, {c.rascunho} rascunho(s), {c.despublicado} despublicado(s)
                      {l.retidos_por_bloqueio ? ` · ${l.retidos_por_bloqueio} retido(s) como rascunho` : ""}
                    </span>
                  </span>
                  {ativos > 0 && (
                    <form action={desfazerLote}>
                      <input type="hidden" name="lote" value={l.id} />
                      <button type="submit" className="botao-secundario">Desfazer lote</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
