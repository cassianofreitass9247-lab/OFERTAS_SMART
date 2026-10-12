"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registrarRespostaPedido } from "@/app/admin/acoes";
import { linkAfiliadoValido } from "@/lib/produto";
import { linkWhatsapp, mensagemAchei, mensagemNaoAchei } from "@/lib/pedido";

type ProdutoOpcao = { id: string; nome: string; link_afiliado: string };
type Props = { pedido: { id: string; nome: string; whatsapp: string; descricao: string }; produtos: ProdutoOpcao[] };

export function ResponderPedido({ pedido, produtos }: Props) {
  const router = useRouter();
  const [modo, setModo] = useState<"achei" | "nao">("achei");
  const [produtoId, setProdutoId] = useState("");
  const [nomeProduto, setNomeProduto] = useState("");
  const [link, setLink] = useState("");
  const [editada, setEditada] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [, iniciar] = useTransition();

  const linkOk = linkAfiliadoValido(link.trim());
  const pronto = modo === "nao" || (linkOk && nomeProduto.trim().length > 0);
  const automatica =
    modo === "nao"
      ? mensagemNaoAchei(pedido)
      : mensagemAchei({ ...pedido, produto: nomeProduto || "[nome do produto]", link: link || "[link de afiliado]" });
  const mensagem = editada ?? automatica;

  function escolher(id: string) {
    setProdutoId(id);
    const p = produtos.find((x) => x.id === id);
    if (p) {
      setNomeProduto(p.nome);
      setLink(p.link_afiliado);
      setEditada(null);
    }
  }

  function aoEnviar() {
    setErro("");
    iniciar(async () => {
      const r = await registrarRespostaPedido(pedido.id, {
        produtoId: modo === "achei" && produtoId ? produtoId : null,
        link: modo === "achei" ? link.trim() : null,
      });
      if (r.erro) setErro(r.erro);
      else router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-linha bg-fundo p-3">
      <div className="flex flex-wrap gap-4 text-sm font-semibold" role="radiogroup" aria-label="Tipo de resposta">
        <label className="flex items-center gap-2">
          <input type="radio" name={`modo-${pedido.id}`} checked={modo === "achei"} onChange={() => { setModo("achei"); setEditada(null); }} />
          Achei o produto
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name={`modo-${pedido.id}`} checked={modo === "nao"} onChange={() => { setModo("nao"); setEditada(null); }} />
          Não encontrei
        </label>
      </div>

      {modo === "achei" && (
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label htmlFor={`prod-${pedido.id}`} className="rotulo">Produto já cadastrado (opcional)</label>
            <select id={`prod-${pedido.id}`} value={produtoId} onChange={(e) => escolher(e.target.value)} className="campo py-2">
              <option value="">Digitar manualmente</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`nome-${pedido.id}`} className="rotulo">Nome do produto</label>
            <input id={`nome-${pedido.id}`} value={nomeProduto} maxLength={200} onChange={(e) => { setNomeProduto(e.target.value); setProdutoId(""); setEditada(null); }} className="campo py-2" />
          </div>
          <div>
            <label htmlFor={`link-${pedido.id}`} className="rotulo">Link de afiliado</label>
            <input id={`link-${pedido.id}`} type="url" value={link} onChange={(e) => { setLink(e.target.value); setProdutoId(""); setEditada(null); }} placeholder="https://s.shopee.com.br/…" className="campo py-2" />
            {link && !linkOk && <p className="mt-1 text-xs font-semibold text-laranja-forte">Use um link https da Shopee (shopee.com.br ou shope.ee).</p>}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor={`msg-${pedido.id}`} className="rotulo">Mensagem (pode editar)</label>
          {editada !== null && (
            <button type="button" onClick={() => setEditada(null)} className="text-xs underline">Refazer mensagem</button>
          )}
        </div>
        <textarea id={`msg-${pedido.id}`} rows={7} value={mensagem} onChange={(e) => setEditada(e.target.value)} className="campo text-sm" />
      </div>

      {erro && <p role="alert" className="text-sm font-semibold text-laranja-forte">{erro}</p>}

      {pronto ? (
        <a href={linkWhatsapp(pedido.whatsapp, mensagem)} target="_blank" rel="noopener noreferrer" onClick={aoEnviar} className="botao bg-[#128c4a] hover:bg-[#0d6b38]">
          Abrir no WhatsApp e marcar como respondido
        </a>
      ) : (
        <p className="text-sm text-cinza">Preencha o nome do produto e um link de afiliado válido para liberar o botão do WhatsApp.</p>
      )}
    </div>
  );
}
