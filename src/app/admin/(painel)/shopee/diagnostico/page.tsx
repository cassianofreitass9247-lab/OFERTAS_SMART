import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { configShopee, consultarShopee, ErroShopee, extrairIds } from "@/lib/shopee";

export const metadata: Metadata = { title: "Diagnóstico da Shopee" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const mensagem = (e: unknown) => (e instanceof ErroShopee ? e.message : "Falha ao consultar a Shopee.");

type Campo = { name: string; type?: { name?: string | null; kind?: string; ofType?: { name?: string | null } | null } };
const tipo = (c: Campo) => c.type?.name ?? c.type?.ofType?.name ?? c.type?.kind ?? "?";

/** Só leitura: mostra os campos que a API realmente oferece e a resposta bruta de um produto. Não grava nada. */
export default async function Diagnostico({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const p = await searchParams;
  const cfg = configShopee();
  const rodar = um(p.rodar) === "1" && cfg.ativo;
  const entrada = um(p.produto).trim().slice(0, 300);

  const esquema: { consultas?: string[]; campos?: Campo[]; erro?: string } = {};
  const bruto: { json?: string; erro?: string } = {};

  if (rodar) {
    try {
      const d = (await consultarShopee(`{ __schema { queryType { fields { name } } } }`)) as { __schema?: { queryType?: { fields?: { name: string }[] } } };
      esquema.consultas = d.__schema?.queryType?.fields?.map((f) => f.name);
    } catch (e) {
      esquema.erro = mensagem(e);
    }
    try {
      const d = (await consultarShopee(`{ __type(name: "ProductOfferV2") { fields { name type { name kind ofType { name } } } } }`)) as { __type?: { fields?: Campo[] } | null };
      esquema.campos = d.__type?.fields ?? undefined;
      if (!esquema.campos && !esquema.erro) esquema.erro = "A Shopee não devolveu o esquema (introspecção desativada ou tipo com outro nome).";
    } catch (e) {
      esquema.erro = esquema.erro ?? mensagem(e);
    }
    try {
      const ids = entrada ? extrairIds(entrada) : null;
      const alvo = ids ? `itemId: ${ids.itemId}, shopId: ${ids.shopId}` : /^\d{5,}$/.test(entrada) ? `itemId: ${entrada}` : `keyword: ${JSON.stringify(entrada || "air fryer")}, limit: 3`;
      // Só os campos já usados pelo painel: mostra exatamente o que a API devolve hoje.
      const d = await consultarShopee(`{ productOfferV2(${alvo}) { nodes { itemId shopId productName priceMin priceMax commissionRate sales ratingStar priceDiscountRate shopName productLink offerLink } } }`);
      bruto.json = JSON.stringify(d, null, 2).slice(0, 6000);
    } catch (e) {
      bruto.erro = mensagem(e);
    }
  }

  return (
    <>
      <h1 className="mb-1 font-titulo text-3xl font-extrabold">Diagnóstico da Shopee</h1>
      <p className="mb-4 max-w-[75ch] text-sm text-cinza">
        Somente leitura. Mostra quais campos a API da Shopee oferece (para saber se existe algo sobre oferta relâmpago ou preço com cupom) e a resposta bruta de um produto, para comparar com a página dele.{" "}
        <Link href="/admin/shopee" className="underline">Voltar</Link>
      </p>
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-linha bg-white p-4">
        <input type="hidden" name="rodar" value="1" />
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="produto" className="rotulo">Link ou número de um produto para comparar (opcional)</label>
          <input id="produto" name="produto" defaultValue={entrada} maxLength={300} placeholder="cole o link da fritadeira do print" className="campo" disabled={!cfg.ativo} />
        </div>
        <button type="submit" className="botao" disabled={!cfg.ativo}>Rodar diagnóstico</button>
      </form>

      {rodar && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 font-titulo text-xl font-extrabold">Campos do produto (ProductOfferV2)</h2>
            {esquema.campos ? (
              <p className="break-words rounded-lg border border-linha bg-white p-3 text-sm" data-testid="campos">
                {esquema.campos.map((c) => `${c.name} (${tipo(c)})`).join(" · ")}
              </p>
            ) : (
              <p role="alert" className="rounded-md border border-laranja bg-laranja-claro p-3 text-sm">{esquema.erro}</p>
            )}
          </section>
          {esquema.consultas && (
            <section>
              <h2 className="mb-2 font-titulo text-xl font-extrabold">Consultas disponíveis</h2>
              <p className="rounded-lg border border-linha bg-white p-3 text-sm">{esquema.consultas.join(" · ")}</p>
            </section>
          )}
          <section>
            <h2 className="mb-2 font-titulo text-xl font-extrabold">Resposta bruta</h2>
            {bruto.json ? (
              <pre className="overflow-x-auto rounded-lg border border-linha bg-white p-3 text-xs">{bruto.json}</pre>
            ) : (
              <p role="alert" className="rounded-md border border-laranja bg-laranja-claro p-3 text-sm">{bruto.erro}</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
