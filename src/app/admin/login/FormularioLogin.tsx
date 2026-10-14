"use client";

import { useActionState, useEffect, useState } from "react";
import { Turnstile } from "@/components/Turnstile";
import { entrar, type Estado } from "../acoes";

export function FormularioLogin({ siteKey = "" }: { siteKey?: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(entrar, {});
  const [token, setToken] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [verSenha, setVerSenha] = useState(false);
  useEffect(() => {
    if (estado.erro) setTentativa((n) => n + 1);
    setVerSenha(false); // depois de cada tentativa, a senha volta a ficar oculta
  }, [estado]);
  const aguardando = Boolean(siteKey) && !token;
  return (
    <form action={acao} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="rotulo">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={estado.valores?.email ?? ""} className="campo" />
      </div>
      <div>
        <label htmlFor="senha" className="rotulo">Senha</label>
        <div className="relative">
          <input
            id="senha"
            name="senha"
            type={verSenha ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            className="campo pr-12"
          />
          <button
            type="button"
            onClick={() => setVerSenha((v) => !v)}
            aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={verSenha}
            aria-controls="senha"
            title={verSenha ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-md text-cinza hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-tinta"
          >
            <IconeOlho aberto={!verSenha} />
          </button>
        </div>
      </div>
      {siteKey && <Turnstile key={tentativa} siteKey={siteKey} acao="login" aoMudar={setToken} />}
      {estado.erro && <p role="alert" className="rounded-md border border-laranja bg-laranja-claro p-3 text-sm">{estado.erro}</p>}
      <button type="submit" disabled={enviando || aguardando} className="botao w-full">
        {enviando ? "Entrando…" : aguardando ? "Verificando segurança…" : "Entrar"}
      </button>
    </form>
  );
}

/** Olho aberto = "mostrar senha"; olho riscado = "ocultar senha". */
function IconeOlho({ aberto }: { aberto: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!aberto && <path d="M3 3l18 18" />}
    </svg>
  );
}
