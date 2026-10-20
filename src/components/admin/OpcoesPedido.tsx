"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buscarOpcoesPedido, marcarOpcoesEnviadas } from "@/app/admin/pedido-opcoes-acoes";
import type { PedidoOpcao } from "@/lib/database.types";
import { enderecoDoPedido, formatarNota, formatarVendas, mensagemOpcoes } from "@/lib/pedido-opcoes";
import { linkWhatsapp } from "@/lib/pedido";
import { formatarDataHora, formatarPreco } from "@/lib/texto";

type Props = {
  pedido: { id: string; nome: string; whatsapp: string; descricao: string; token: string; busca_resultado: string | null; buscado_em: string | null };
  opcoes: PedidoOpcao[];
  termo: string;
  siteUrl: string;
};

/** Painel das opções automáticas de um pedido: buscar, conferir e mandar a página pelo WhatsApp com um toque. */
export function OpcoesPedido({ pedido, opcoes, termo, siteUrl }: Props) {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [, iniciar] = useTransition();
  const url = enderecoDoPedido(siteUrl, pedido.token);
  const mensagem = mensagemOpcoes({ nome: pedido.nome, descricao: pedido.descricao, url, quantidade: opcoes.length });

  function aoEnviar() {
    setErro("");
    iniciar(async () => {
      const r = await marcarOpcoesEnviadas(pedido.id);
      if (r.erro) setErro(r.erro);
      else router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-linha bg-white p-3">
      <form action={buscarOpcoesPedido} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={pedido.id} />
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor={`termo-${pedido.id}`} className="rotulo">Buscar na Shopee por</label>
          <input id={`termo-${pedido.id}`} name="termo" maxLength={100} defaultValue={termo} className="campo" aria-describedby={`d-termo-${pedido.id}`} />
        </div>
        <button type="submit" className="botao">{opcoes.length ? "Buscar de novo" : "Buscar opções"}</button>
        <p id={`d-termo-${pedido.id}`} className="basis-full text-xs text-cinza">
          Sugestão tirada do pedido; ajuste se achar melhor. Escolhe 3 a 5 produtos variados (mais parecido, mais vendido, mais bem avaliado, mais barato) e gera um link de
          afiliado de cada um, com o identificador do pedido.
        </p>
      </form>

      {pedido.busca_resultado && (
        <p className="text-sm text-cinza">
          Última busca{pedido.buscado_em ? ` em ${formatarDataHora(pedido.buscado_em)}` : ""}: {pedido.busca_resultado}
        </p>
      )}

      {opcoes.length > 0 && (
        <>
          <ol className="divide-y divide-linha rounded-md border border-linha">
            {opcoes.map((o) => (
              <li key={o.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 p-2 text-sm">
                <span className="rounded bg-pessego px-1.5 py-0.5 text-xs font-bold">{o.rotulo}</span>
                <a href={o.link_afiliado} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 flex-1 basis-64 underline">
                  {o.nome}
                </a>
                <span className="preco font-semibold">{o.preco !== null ? formatarPreco(o.preco) : "sem preço"}</span>
                <span className="text-cinza">
                  {[o.nota !== null ? `★ ${formatarNota(o.nota)}` : null, o.vendas ? formatarVendas(o.vendas) : null, o.cliques ? `${o.cliques} clique(s)` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ol>

          <div>
            <label htmlFor={`msg-${pedido.id}`} className="rotulo">Mensagem para o WhatsApp</label>
            <textarea id={`msg-${pedido.id}`} readOnly rows={10} value={mensagem} className="campo" />
            <p className="mt-1 text-xs break-all text-cinza">Página da cliente: {url}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={linkWhatsapp(pedido.whatsapp, mensagem)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={aoEnviar}
              className="botao"
            >
              Enviar pelo WhatsApp e marcar como respondido
            </a>
            <p className="text-xs text-cinza">Abre o WhatsApp da Moni com a mensagem pronta; o envio é feito por ela, no próprio aparelho.</p>
          </div>
        </>
      )}
      {erro && <p role="alert" className="rounded-md border border-laranja bg-laranja-claro p-2 text-sm">{erro}</p>}
    </div>
  );
}
