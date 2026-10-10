"use client";

import { useActionState } from "react";
import { entrar, type Estado } from "../acoes";

export function FormularioLogin() {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(entrar, {});
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
      {estado.erro && <p role="alert" className="rounded-md border border-laranja bg-laranja-claro p-3 text-sm">{estado.erro}</p>}
      <button type="submit" disabled={enviando} className="botao w-full">{enviando ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
