"use client";

import { useActionState, useEffect, useState } from "react";
import { Turnstile } from "@/components/Turnstile";
import { entrar, type Estado } from "../acoes";

export function FormularioLogin({ siteKey = "" }: { siteKey?: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(entrar, {});
  const [token, setToken] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (estado.erro) setTentativa((n) => n + 1);
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
        <input id="senha" name="senha" type="password" autoComplete="current-password" required className="campo" />
      </div>
      {siteKey && <Turnstile key={tentativa} siteKey={siteKey} acao="login" aoMudar={setToken} />}
      {estado.erro && <p role="alert" className="rounded-md border border-laranja bg-laranja-claro p-3 text-sm">{estado.erro}</p>}
      <button type="submit" disabled={enviando || aguardando} className="botao w-full">
        {enviando ? "Entrando…" : aguardando ? "Verificando segurança…" : "Entrar"}
      </button>
    </form>
  );
}
