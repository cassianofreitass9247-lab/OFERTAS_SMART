/* eslint-disable @next/next/no-img-element -- imagens externas sem otimizador pago */
import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/components/admin/Aviso";
import {
  buscarOfertaPorItem,
  buscarOfertas,
  configShopee,
  ehOrdem,
  ErroShopee,
  interpretarEntrada,
  ORDENS,
  precoDaOferta,
  resolverLinkCurto,
  type Oferta,
  type Ordem,
} from "@/lib/shopee";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatarPreco } from "@/lib/texto";
import { criarRascunhoShopee, testarConexaoShopee } from "../../shopee-acoes";

export const metadata: Metadata = { title: "Importar da Shopee" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type Resultado = { ofertas: Oferta[]; temMais: boolean; tipo: "palavra" | "item"; erro?: string };

async function pesquisar(q: string, ordem: Ordem, pagina: number): Promise<Resultado> {
  const alvo = interpretarEntrada(q);
  if (alvo.tipo === "erro") return { ofertas: [], temMais: false, tipo: "item", erro: alvo.erro };
  try {
    if (alvo.tipo === "palavra") {
      const r = await buscarOfertas({ termo: alvo.termo, ordem, pagina });
      return { ...r, tipo: "palavra" };
    }
    let ids = alvo.tipo === "item" ? { itemId: alvo.itemId, shopId: alvo.shopId } : null;
    if (alvo.tipo === "curto") {
      const r = await resolverLinkCurto(alvo.url);
      if ("erro" in r) return { ofertas: [], temMais: false, tipo: "item", erro: r.erro };
      ids = r;
    }
    const oferta = ids ? await buscarOfertaPorItem(ids.itemId, ids.shopId) : null;
    if (!oferta) return { ofertas: [], temMais: false, tipo: "item", erro: "A Shopee não devolveu este produto (pode não participar do programa de afiliados ou ter saído do ar)." };
    return { ofertas: [oferta], temMais: false, tipo: "item" };
  } catch (e) {
    return {
      ofertas: [],
      temMais: false,
      tipo: "item",
      erro: e instanceof ErroShopee ? e.message : "Não foi possível consultar a Shopee agora. Tente de novo em instantes.",
    };
  }
}

export default async function PaginaShopee({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = await searchParams;
  const q = um(parametros.q).trim().slice(0, 300);
  const ordem: Ordem = ehOrdem(um(parametros.ordem)) ? (um(parametros.ordem) as Ordem) : "relevancia";
  const pagina = Math.min(Math.max(Number.parseInt(um(parametros.pagina), 10) || 1, 1), 50);
  const cfg = configShopee();

  const resultado = q && cfg.ativo ? await pesquisar(q, ordem, pagina) : null;

  // Quais destes produtos já estão cadastrados?
  const cadastrados = new Map<string, string>();
  if (resultado?.ofertas.length) {
    const sb = await clienteServidor();
    const { data } = await sb
      .from("produtos")
      .select("id, id_externo")
      .in("id_externo", resultado.ofertas.map((o) => `${o.shopId}.${o.itemId}`));
    for (const p of data ?? []) if (p.id_externo) cadastrados.set(p.id_externo, p.id);
  }

  const proxima = `/admin/shopee?q=${encodeURIComponent(q)}&ordem=${ordem}&pagina=${pagina + 1}`;
  const anterior = `/admin/shopee?q=${encodeURIComponent(q)}&ordem=${ordem}&pagina=${pagina - 1}`;

  return (
    <>
      <h1 className="mb-1 font-titulo text-3xl font-extrabold">Importar da Shopee</h1>
      <p className="mb-4 max-w-[75ch] text-sm text-cinza">
        Cole o link de um produto da Shopee (ou só o número dele) ou digite o que procura. O site traz nome, foto, preço e comissão e cria um{" "}
        <strong>rascunho</strong> com o seu link de afiliado. Nada é publicado sozinho: você revisa e publica.{" "}
        <Link href="/admin/shopee/lote" className="underline">Importar vários de uma vez (lote)</Link>
      </p>
      <Aviso parametros={parametros} />

      {cfg.incompleto ? (
        <p role="alert" className="mb-4 rounded-md border border-laranja bg-laranja-claro p-3 text-sm">
          Configuração incompleta: falta cadastrar <code>SHOPEE_APP_ID</code> ou <code>SHOPEE_SECRET</code> no Worker. Cadastre as duas (veja o README).
        </p>
      ) : !cfg.ativo ? (
        <div className="mb-4 rounded-md border border-laranja bg-laranja-claro p-4 text-sm">
          <p className="font-semibold">A integração ainda não está configurada.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>No Cloudflare, abra Workers &amp; Pages &gt; <code>ofertasmart</code> &gt; Settings &gt; Variables and Secrets.</li>
            <li>Cadastre <code>SHOPEE_APP_ID</code> (tipo Text) e <code>SHOPEE_SECRET</code> (tipo <strong>Secret</strong>) com os valores do portal de afiliados.</li>
            <li>Salve (Deploy) e volte aqui.</li>
          </ol>
        </div>
      ) : (
        <form action={testarConexaoShopee} className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span>Credenciais cadastradas.</span>
          <button type="submit" className="botao-secundario">Testar conexão</button>
        </form>
      )}

      <form action="/admin/shopee" method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-linha bg-white p-4">
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="q" className="rotulo">Link do produto, número do produto ou palavra-chave</label>
          <input id="q" name="q" defaultValue={q} maxLength={300} placeholder="https://shopee.com.br/… ou air fryer 4 litros" className="campo" disabled={!cfg.ativo} />
        </div>
        <div>
          <label htmlFor="ordem" className="rotulo">Ordem (palavra-chave)</label>
          <select id="ordem" name="ordem" defaultValue={ordem} className="campo" disabled={!cfg.ativo}>
            {ORDENS.map((o) => (
              <option key={o.valor} value={o.valor}>{o.rotulo}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="botao" disabled={!cfg.ativo}>Buscar</button>
      </form>

      {resultado?.erro && (
        <p role="alert" className="mb-4 rounded-md border border-laranja bg-laranja-claro p-3 text-sm">{resultado.erro}</p>
      )}
      {resultado && !resultado.erro && resultado.ofertas.length === 0 && (
        <p className="rounded-lg border border-dashed border-linha bg-white p-8 text-center">Nenhum produto encontrado.</p>
      )}

      {resultado && resultado.ofertas.length > 0 && (
        <>
          <ul className="space-y-3">
            {resultado.ofertas.map((o) => {
              const idExterno = `${o.shopId}.${o.itemId}`;
              const existente = cadastrados.get(idExterno);
              const preco = precoDaOferta(o);
              return (
                <li key={idExterno} className="flex flex-wrap gap-4 rounded-lg border border-linha bg-white p-4">
                  {o.imagemUrl ? (
                    <img src={o.imagemUrl} alt="" width={96} height={96} referrerPolicy="no-referrer" className="size-24 flex-none rounded-md bg-white object-contain" />
                  ) : (
                    <div className="flex size-24 flex-none items-center justify-center rounded-md bg-fundo text-xs text-cinza">Sem foto</div>
                  )}
                  <div className="min-w-[11rem] flex-1">
                    <p className="font-semibold leading-snug">{o.nome}</p>
                    {o.loja && <p className="text-sm text-cinza">{o.loja}</p>}
                    <p className="mt-1 text-sm">
                      <span className="preco font-extrabold">{preco !== null ? formatarPreco(preco) : "sem preço"}</span>
                      {o.precoMax !== null && preco !== null && o.precoMax > preco && <span className="text-cinza"> (a partir de; até {formatarPreco(o.precoMax)})</span>}
                      {o.desconto ? <span className="ml-2 rounded bg-laranja-claro px-1.5 py-0.5 text-xs font-semibold">{o.desconto}% de desconto na Shopee</span> : null}
                    </p>
                    <p className="mt-1 text-sm text-cinza">
                      {o.comissao !== null && <>Comissão: {o.comissao.toLocaleString("pt-BR")}%</>}
                      {o.vendas !== null && <> · {o.vendas.toLocaleString("pt-BR")} vendas</>}
                      {o.nota !== null && <> · nota {o.nota.toLocaleString("pt-BR")}</>}
                    </p>
                  </div>
                  <div className="flex w-full flex-none items-center sm:w-auto">
                    {existente ? (
                      <Link href={`/admin/produtos/${existente}`} className="botao-secundario">Já cadastrado: abrir</Link>
                    ) : (
                      <form action={criarRascunhoShopee}>
                        <input type="hidden" name="item" value={o.itemId} />
                        <input type="hidden" name="loja" value={o.shopId} />
                        <input type="hidden" name="q" value={q} />
                        <button type="submit" className="botao">Criar rascunho</button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {resultado.tipo === "palavra" && (pagina > 1 || resultado.temMais) && (
            <nav aria-label="Páginas" className="mt-4 flex gap-3">
              {pagina > 1 && <Link href={anterior} className="botao-secundario">Página anterior</Link>}
              {resultado.temMais && <Link href={proxima} className="botao-secundario">Próxima página</Link>}
            </nav>
          )}
          <p className="mt-4 max-w-[75ch] text-xs text-cinza">
            Preços e comissões são os que a Shopee informa agora e podem mudar. A comissão é exibida só para você, nunca no site.
          </p>
        </>
      )}
    </>
  );
}
