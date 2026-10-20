import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/components/admin/Aviso";
import { OpcoesPedido } from "@/components/admin/OpcoesPedido";
import { ResponderPedido } from "@/components/admin/ResponderPedido";
import { SITE_URL } from "@/lib/config";
import type { PedidoOpcao, StatusPedido } from "@/lib/database.types";
import { formatarWhatsapp } from "@/lib/pedido";
import { termoDeBusca } from "@/lib/pedido-opcoes";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatarDataHora } from "@/lib/texto";
import { alterarStatusPedido, excluirPedido } from "../../acoes";
import { definirBuscaAutomatica } from "../../pedido-opcoes-acoes";
import { F } from "@/lib/marca";

export const metadata: Metadata = { title: "Pedidos" };

const ABAS: { status: StatusPedido; rotulo: string }[] = [
  { status: "novo", rotulo: "Novos" },
  { status: "respondido", rotulo: "Respondidos" },
  { status: "arquivado", rotulo: "Arquivados" },
];
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PaginaPedidos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parametros = await searchParams;
  const status: StatusPedido = ABAS.some((a) => a.status === um(parametros.status)) ? (um(parametros.status) as StatusPedido) : "novo";
  const caminho = `/admin/pedidos?status=${status}`;

  const sb = await clienteServidor();
  const [pedidos, produtos, auto] = await Promise.all([
    sb.from("pedidos").select("*").eq("status", status).order("criado_em", { ascending: status === "novo" }).limit(200),
    status === "novo"
      ? sb.from("produtos").select("id, nome, link_afiliado").eq("ficticio", false).neq("status_publicacao", "despublicado").order("nome").limit(1000)
      : Promise.resolve({ data: [] as { id: string; nome: string; link_afiliado: string }[] }),
    sb.rpc("pedidos_auto_ligado"),
  ]);
  // Sem a migração 0012 a função não existe: o painel avisa em vez de quebrar.
  const autoIndisponivel = Boolean(auto.error);
  const autoLigada = auto.data === true;
  const semTabela = pedidos.error && /pedidos/.test(pedidos.error.message);
  const lista = pedidos.data ?? [];
  // Opções automáticas de cada pedido (vazio se a migração 0011 ainda não foi aplicada).
  const opcoesDe = new Map<string, PedidoOpcao[]>();
  if (lista.length > 0) {
    const { data } = await sb.from("pedido_opcoes").select("*").in("pedido_id", lista.map((p) => p.id)).order("posicao");
    for (const o of data ?? []) opcoesDe.set(o.pedido_id, [...(opcoesDe.get(o.pedido_id) ?? []), o]);
  }

  return (
    <>
      <h1 className="mb-1 font-titulo text-3xl font-extrabold">Pedidos dos visitantes</h1>
      <p className="mb-4 max-w-[75ch] text-sm text-cinza">
        Pedidos feitos em <Link href="/pedir" className="underline">/pedir</Link>. O botão abre o WhatsApp {F.da} com a mensagem pronta; o envio é feito
        por ela, no próprio aparelho. Os pedidos são apagados automaticamente 90 dias depois de criados.
      </p>
      <Aviso parametros={parametros} />

      <section aria-labelledby="busca-auto" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-linha bg-white p-4">
        <div className="min-w-0 max-w-[70ch]">
          <h2 id="busca-auto" className="font-semibold">
            Busca automática ao receber o pedido: {autoIndisponivel ? "indisponível" : autoLigada ? "ligada" : "desligada"}
          </h2>
          <p className="mt-1 text-sm text-cinza">
            {autoIndisponivel
              ? "Aplique a migração 0012_pedidos_busca_automatica.sql no Supabase para usar este recurso."
              : "Ligada: assim que a pessoa envia o pedido, o site procura na Shopee e mostra na confirmação a página com 3 a 5 opções (até 30 buscas por hora). Você continua vendo todos os pedidos aqui e pode responder pelo WhatsApp. Se a Shopee falhar, o pedido chega normal."}
          </p>
        </div>
        {!autoIndisponivel && (
          <form action={definirBuscaAutomatica}>
            <input type="hidden" name="ligar" value={autoLigada ? "nao" : "sim"} />
            <button type="submit" className={autoLigada ? "botao-secundario" : "botao"}>
              {autoLigada ? "Desligar" : "Ligar"}
            </button>
          </form>
        )}
      </section>

      <nav aria-label="Situação" className="mb-4 flex gap-2">
        {ABAS.map((a) => (
          <Link key={a.status} href={`/admin/pedidos?status=${a.status}`} aria-current={a.status === status ? "page" : undefined} className={a.status === status ? "botao" : "botao-secundario"}>
            {a.rotulo}
          </Link>
        ))}
      </nav>

      {semTabela ? (
        <p role="alert" className="rounded-md border border-laranja bg-laranja-claro p-3 text-sm">
          A tabela de pedidos ainda não existe no banco. Aplique a migração <code>supabase/migrations/0002_pedidos_e_video.sql</code> no SQL Editor do
          Supabase (veja o README).
        </p>
      ) : pedidos.error ? (
        <p role="alert" className="rounded-md border border-laranja bg-laranja-claro p-3 text-sm">Não foi possível listar os pedidos: {pedidos.error.message}</p>
      ) : lista.length === 0 ? (
        <p className="rounded-lg border border-dashed border-linha bg-white p-8 text-center">Nenhum pedido nesta aba.</p>
      ) : (
        <ul className="space-y-3">
          {lista.map((p) => (
            <li key={p.id} className="rounded-lg border border-linha bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {p.nome} · <span className="preco">{formatarWhatsapp(p.whatsapp)}</span>
                  </p>
                  <p className="text-xs text-cinza">
                    Pedido em {formatarDataHora(p.criado_em)}
                    {p.respondido_em && <> · respondido em {formatarDataHora(p.respondido_em)}</>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ABAS.filter((a) => a.status !== status).map((a) => (
                    <form key={a.status} action={alterarStatusPedido}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value={a.status} />
                      <input type="hidden" name="voltar" value={caminho} />
                      <button type="submit" className="botao-secundario py-1.5">
                        {a.status === "novo" ? "Reabrir" : a.status === "arquivado" ? "Arquivar" : "Marcar respondido"}
                      </button>
                    </form>
                  ))}
                  <form action={excluirPedido}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="voltar" value={caminho} />
                    <button type="submit" className="botao-secundario py-1.5">Excluir</button>
                  </form>
                </div>
              </div>

              <p className="mt-2 whitespace-pre-line">{p.descricao}</p>
              {p.referencia_url && (
                <p className="mt-1 text-sm break-all">
                  Exemplo enviado:{" "}
                  <a href={p.referencia_url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                    {p.referencia_url}
                  </a>
                </p>
              )}
              {p.link_enviado && <p className="mt-1 text-sm break-all text-cinza">Link enviado: {p.link_enviado}</p>}

              {status === "novo" && p.token && (
                <OpcoesPedido
                  pedido={{ id: p.id, nome: p.nome, whatsapp: p.whatsapp, descricao: p.descricao, token: p.token, busca_resultado: p.busca_resultado ?? null, buscado_em: p.buscado_em ?? null }}
                  opcoes={opcoesDe.get(p.id) ?? []}
                  termo={p.busca_termo ?? termoDeBusca(p.descricao)}
                  siteUrl={SITE_URL}
                />
              )}
              {status === "novo" && !p.token && (
                <p className="mt-3 text-sm text-cinza">Opções automáticas: aplique a migração <code>0011_pedido_opcoes.sql</code> no Supabase.</p>
              )}
              {status === "novo" && <ResponderPedido pedido={p} produtos={produtos.data ?? []} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
