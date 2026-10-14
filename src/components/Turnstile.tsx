"use client";

import { useEffect, useRef } from "react";

type OpcoesWidget = {
  sitekey: string;
  action: string;
  appearance: "always" | "execute" | "interaction-only";
  language: string;
  theme: "light" | "dark" | "auto";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => boolean | void;
  "timeout-callback": () => void;
};
type ApiTurnstile = { render: (el: HTMLElement, op: OpcoesWidget) => string; remove: (id: string) => void };

declare global {
  interface Window {
    turnstile?: ApiTurnstile;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let carregando: Promise<ApiTurnstile> | null = null;

function carregarScript(): Promise<ApiTurnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  carregando ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    s.onerror = () => {
      carregando = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return carregando;
}

/**
 * Verificação "não sou robô" do Cloudflare. Normalmente invisível: só aparece uma caixinha quando o
 * Cloudflare desconfia. O token vai no formulário no campo "cf-turnstile-response".
 * Para pedir um token novo (cada um vale uma vez), troque a prop `key` do componente.
 */
export function Turnstile({ siteKey, acao, aoMudar }: { siteKey: string; acao: string; aoMudar: (token: string | null) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const aviso = useRef<HTMLParagraphElement>(null);
  const retorno = useRef(aoMudar);
  retorno.current = aoMudar;

  useEffect(() => {
    let id: string | null = null;
    let ativo = true;
    retorno.current(null);
    carregarScript()
      .then((api) => {
        if (!ativo || !caixa.current) return;
        id = api.render(caixa.current, {
          sitekey: siteKey,
          action: acao,
          appearance: "interaction-only",
          language: "pt-br",
          theme: "light",
          callback: (t) => retorno.current(t),
          "expired-callback": () => retorno.current(null),
          "timeout-callback": () => retorno.current(null),
          "error-callback": () => {
            retorno.current(null);
            if (aviso.current) aviso.current.hidden = false;
            return true;
          },
        });
      })
      .catch(() => {
        if (aviso.current) aviso.current.hidden = false;
      });
    return () => {
      ativo = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey, acao]);

  return (
    <div>
      <div ref={caixa} />
      <p ref={aviso} hidden role="alert" className="mt-2 text-sm">
        A verificação de segurança não carregou. Desative bloqueadores de anúncio para este site ou recarregue a página.
      </p>
    </div>
  );
}
