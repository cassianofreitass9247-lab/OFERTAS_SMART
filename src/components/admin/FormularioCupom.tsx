"use client";

import Link from "next/link";
import { useActionState } from "react";
import { salvarCupom, type Estado } from "@/app/admin/acoes";
import { ROTULO_TIPO, TIPOS_CUPOM } from "@/lib/cupom";
import type { Cupom } from "@/lib/database.types";
import { MARCA } from "@/lib/marca";

type Props = { cupom?: Cupom; categorias: { id: string; nome: string }[] };

// Datas do banco (instante) viram o dia do calendário de Brasília, que é o que o campo de data mostra.
const DIA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
const dia = (iso: string | undefined) => (iso ? DIA.format(new Date(iso)) : "");
const numero = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

export function FormularioCupom({ cupom, categorias }: Props) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(salvarCupom, {});
  const c = cupom;
  const v = estado.valores;
  const txt = (campo: string, original: string | null | undefined) => (v ? (v[campo] ?? "") : (original ?? ""));
  const marcado = (campo: string, original: boolean | undefined) => (v ? v[campo] === "on" : original);

  return (
    <form action={acao} className="mb-8 max-w-2xl space-y-5 rounded-lg border border-linha bg-white p-4">
      <h2 className="font-titulo text-lg font-bold">{c ? "Editar cupom" : "Novo cupom"}</h2>
      {c && <input type="hidden" name="id" value={c.id} />}

      <div>
        <label htmlFor="titulo" className="rotulo">Título (aparece no cartão)</label>
        <input id="titulo" name="titulo" required minLength={3} maxLength={120} defaultValue={txt("titulo", c?.titulo)} placeholder="10% de desconto em Beleza" className="campo" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="codigo" className="rotulo">Código do cupom</label>
          <input id="codigo" name="codigo" maxLength={40} defaultValue={txt("codigo", c?.codigo)} placeholder={`${MARCA.apelido.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12) || "CUPOM"}10`} className="campo" aria-describedby="d-codigo" />
          <p id="d-codigo" className="mt-1 text-sm text-cinza">Se o cupom tem código, o visitante copia com um toque.</p>
        </div>
        <div>
          <label htmlFor="link_resgate" className="rotulo">Link de resgate</label>
          <input id="link_resgate" name="link_resgate" type="url" defaultValue={txt("link_resgate", c?.link_resgate)} placeholder="https://s.shopee.com.br/…" className="campo" aria-describedby="d-link" />
          <p id="d-link" className="mt-1 text-sm text-cinza">Para cupom que se resgata por link, no portal de afiliados. Informe o código, o link, ou os dois.</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label htmlFor="tipo" className="rotulo">Tipo</label>
          <select key={txt("tipo", c?.tipo ?? "percentual")} id="tipo" name="tipo" defaultValue={txt("tipo", c?.tipo ?? "percentual")} className="campo">
            {TIPOS_CUPOM.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="valor" className="rotulo">Valor (% ou R$)</label>
          <input id="valor" name="valor" inputMode="decimal" defaultValue={txt("valor", numero(c?.valor))} placeholder="10" className="campo" aria-describedby="d-valor" />
          <p id="d-valor" className="mt-1 text-sm text-cinza">Não use para frete grátis.</p>
        </div>
        <div>
          <label htmlFor="teto" className="rotulo">Desconto máximo (R$)</label>
          <input id="teto" name="teto" inputMode="decimal" defaultValue={txt("teto", numero(c?.teto))} placeholder="20" className="campo" aria-describedby="d-teto" />
          <p id="d-teto" className="mt-1 text-sm text-cinza">Só para percentual. Opcional.</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="minimo_compra" className="rotulo">Compra mínima (R$, opcional)</label>
          <input id="minimo_compra" name="minimo_compra" inputMode="decimal" defaultValue={txt("minimo_compra", numero(c?.minimo_compra))} placeholder="50" className="campo" />
        </div>
        <div>
          <label htmlFor="categoria_id" className="rotulo">Vale para a categoria (opcional)</label>
          <select key={txt("categoria_id", c?.categoria_id)} id="categoria_id" name="categoria_id" defaultValue={txt("categoria_id", c?.categoria_id)} className="campo" aria-describedby="d-cat">
            <option value="">Todas / geral</option>
            {categorias.map((cat) => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
          </select>
          <p id="d-cat" className="mt-1 text-sm text-cinza">Com categoria, os produtos dela ganham o selo “Cupom disponível”.</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="valido_ate" className="rotulo">Válido até (inclusive)</label>
          <input id="valido_ate" name="valido_ate" type="date" required defaultValue={txt("valido_ate", dia(c?.valido_ate))} className="campo" aria-describedby="d-ate" />
          <p id="d-ate" className="mt-1 text-sm text-cinza">Vale até 23:59 (Brasília) desse dia; depois o cupom some do site sozinho.</p>
        </div>
        <div>
          <label htmlFor="valido_de" className="rotulo">Começa em (opcional)</label>
          <input id="valido_de" name="valido_de" type="date" defaultValue={txt("valido_de", dia(c?.valido_de))} className="campo" aria-describedby="d-de" />
          <p id="d-de" className="mt-1 text-sm text-cinza">Em branco = aparece assim que salvar.</p>
        </div>
      </div>

      <div>
        <label htmlFor="descricao" className="rotulo">Detalhes (opcional)</label>
        <textarea id="descricao" name="descricao" rows={3} maxLength={500} defaultValue={txt("descricao", c?.descricao)} className="campo" />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={marcado("ativo", c ? c.ativo : true)} className="size-4" />
          Mostrar no site
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="destaque" defaultChecked={marcado("destaque", c?.destaque)} className="size-4" />
          Destaque (aparece primeiro e na página inicial)
        </label>
      </div>

      {estado.erro && <p role="alert" className="rounded-md border border-laranja bg-laranja-claro p-3 text-sm">{estado.erro}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={enviando} className="botao">{enviando ? "Salvando…" : c ? "Salvar alterações" : "Cadastrar cupom"}</button>
        {c && <Link href="/admin/cupons" className="text-sm underline">Cancelar</Link>}
      </div>
    </form>
  );
}
