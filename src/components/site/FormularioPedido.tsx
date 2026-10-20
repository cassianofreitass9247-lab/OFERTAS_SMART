"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { enviarPedido, type EstadoPedido } from "@/app/(site)/pedir/acoes";
import { Turnstile } from "@/components/Turnstile";
import { IconeWhatsapp } from "./Icones";

const campo =
  "block w-full rounded-2xl border-[2.5px] border-tinta bg-white px-4 py-3 text-base text-tinta placeholder:text-cinza focus:shadow-[4px_4px_0_#1e120c] focus:outline-none";
const rotulo = "mb-1.5 block font-bold";

export function FormularioPedido({ busca = "", siteKey = "" }: { busca?: string; siteKey?: string }) {
  const [estado, acao, enviando] = useActionState<EstadoPedido, FormData>(enviarPedido, {});
  const [token, setToken] = useState<string | null>(null);
  // Cada token vale uma vez: depois de cada envio, o widget é recriado para gerar outro.
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (estado.erro) setTentativa((n) => n + 1);
  }, [estado]);
  const aguardandoVerificacao = Boolean(siteKey) && !token;
  const v = estado.valores;
  const txt = (nome: string, inicial = "") => (v ? (v[nome] ?? "") : inicial);

  if (estado.ok) {
    const quantidade = estado.quantidade ?? 0;
    return (
      <div role="status" className="rounded-[26px] border-[3px] border-tinta bg-sol p-7 shadow-duro">
        <h2 className="font-titulo text-3xl font-extrabold">Pedido enviado!</h2>
        {estado.pagina ? (
          <>
            <p className="mt-3 text-lg leading-relaxed">
              Já separei {quantidade === 1 ? "1 opção" : `${quantidade} opções`} pra você escolher. A Moni também vai ler o seu pedido e pode chamar você no
              WhatsApp com algo ainda melhor.
            </p>
            <Link href={estado.pagina} className="vm-btn vm-pilula mt-5 min-h-14 bg-neon text-lg font-extrabold text-tinta shadow-duro-p">
              Ver as opções
            </Link>
            <p className="mt-3 text-sm">Salve a página nos favoritos: ela é só sua, e quem tiver o link consegue vê-la.</p>
          </>
        ) : (
          <>
            <p className="mt-3 text-lg leading-relaxed">
              A Moni vai procurar e, se encontrar uma boa opção, chama você no WhatsApp com o link. Não dá para garantir que todo produto será encontrado,
              mas todo pedido é lido.
            </p>
            <Link href="/ofertas" className="vm-btn vm-pilula mt-5 bg-white text-tinta">
              Enquanto isso, ver as ofertas
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <form action={acao} className="space-y-5 rounded-[26px] border-[3px] border-tinta bg-white p-6 shadow-duro sm:p-8">
      <div>
        <label htmlFor="descricao" className={rotulo}>O que você procura?</label>
        <textarea
          id="descricao"
          name="descricao"
          required
          minLength={3}
          maxLength={500}
          rows={4}
          defaultValue={txt("descricao", busca)}
          placeholder="Ex.: mochila escolar de rodinha, rosa, para menina de 7 anos, até R$ 120"
          className={campo}
        />
        <p className="mt-1 text-sm text-cinza">Quanto mais detalhes (cor, tamanho, faixa de preço), melhor.</p>
      </div>

      <div>
        <label htmlFor="referencia" className={rotulo}>
          Link ou foto de exemplo <span className="font-medium text-cinza">(opcional)</span>
        </label>
        <input id="referencia" name="referencia" type="url" maxLength={2000} defaultValue={txt("referencia")} placeholder="https://…" className={campo} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="nome" className={rotulo}>Seu nome</label>
          <input id="nome" name="nome" required minLength={2} maxLength={60} autoComplete="given-name" defaultValue={txt("nome")} className={campo} />
        </div>
        <div>
          <label htmlFor="whatsapp" className={rotulo}>Seu WhatsApp com DDD</label>
          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel-national"
            maxLength={20}
            defaultValue={txt("whatsapp")}
            placeholder="(11) 91234-5678"
            className={campo}
          />
        </div>
      </div>

      {/* Armadilha para robôs: escondido de pessoas e de leitores de tela. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="empresa">Empresa</label>
        <input id="empresa" name="empresa" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <label className="flex items-start gap-3 text-[15px] leading-snug">
        <input type="checkbox" name="consentimento" required defaultChecked={v?.consentimento === "on"} className="mt-0.5 size-5 flex-none accent-[#ff5b14]" />
        <span>
          Autorizo a Moni a me chamar neste WhatsApp para responder este pedido, inclusive com link de afiliado da Shopee. Meus dados ficam guardados
          por até 90 dias e não são repassados. <Link href="/privacidade" className="underline">Política de privacidade</Link>.
        </span>
      </label>

      {siteKey && <Turnstile key={tentativa} siteKey={siteKey} acao="pedido" aoMudar={setToken} />}

      {estado.erro && (
        <p role="alert" className="rounded-2xl border-[2.5px] border-tinta bg-[#ffe0ea] p-3 font-semibold">
          {estado.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando || aguardandoVerificacao}
        className="vm-btn vm-pilula min-h-14 w-full cursor-pointer bg-neon text-lg font-extrabold text-tinta shadow-duro-p disabled:cursor-wait disabled:opacity-70 sm:w-auto"
      >
        <IconeWhatsapp tamanho={22} />
        {enviando ? "Enviando…" : aguardandoVerificacao ? "Verificando segurança…" : "Enviar pedido"}
      </button>
    </form>
  );
}
