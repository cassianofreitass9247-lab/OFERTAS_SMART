import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { configShopee, consultarShopee, ErroShopee, interpretarEntrada, resolverLinkCurto } from "@/lib/shopee";

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
  const bruto: { json?: string; erro?: string; periodos?: string[] } = {};

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
      if (!esquema.campos && !esquema.erro) esquema.erro = "A Shopee não devolveu o esquema.";
    } catch (e) {
      esquema.erro = esquema.erro ?? mensagem(e);
    }
    try {
      // Aceita link completo, link curto (s.shopee.com.br), número do produto ou palavra-chave.
      const alvoEntrada = interpretarEntrada(entrada || "air fryer");
      let filtro: string;
      if (alvoEntrada.tipo === "erro") throw new ErroShopee(null, alvoEntrada.erro);
      if (alvoEntrada.tipo === "palavra") filtro = `keyword: ${JSON.stringify(alvoEntrada.termo)}, limit: 3`;
      else {
        const ids: { itemId: string; shopId: string | null } | { erro: string } = alvoEntrada.tipo === "item" ? alvoEntrada : await resolverLinkCurto(alvoEntrada.url);
        if ("erro" in ids) throw new ErroShopee(null, ids.erro);
        filtro = `itemId: ${ids.itemId}${ids.shopId ? `, shopId: ${ids.shopId}` : ""}`;
      }
      // Todos os campos abaixo foram confirmados pela própria API (lista acima), inclusive os que o painel ainda não usa.
      const d = await consultarShopee(
        `{ productOfferV2(${filtro}) { nodes { itemId shopId productName price priceMin priceMax priceDiscountRate sales ratingStar commissionRate commission sellerCommissionRate shopeeCommissionRate appExistRate appNewRate webExistRate webNewRate periodStartTime periodEndTime productCatIds shopType shopName productLink offerLink } } }`,
      );
      bruto.json = JSON.stringify(d, null, 2).slice(0, 8000);
      const nos = ((d as { productOfferV2?: { nodes?: Record<string, unknown>[] } }).productOfferV2?.nodes ?? []).slice(0, 3);
      const quando = (v: unknown) => (typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v)) ? new Date(Number(v) * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
      bruto.periodos = nos.map((n) => `${String(n.productName ?? "").slice(0, 50)}: período ${quando(n.periodStartTime)} até ${quando(n.periodEndTime)}`);
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
          <input id="produto" name="produto" defaultValue={entrada} maxLength={300} placeholder="link completo, link curto (s.shopee.com.br) ou número" className="campo" disabled={!cfg.ativo} />
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
              <>
                {bruto.periodos?.length ? (
                  <p className="mb-2 rounded-lg border border-linha bg-white p-3 text-sm" data-testid="periodos">
                    <strong>Período informado pela Shopee (periodStartTime / periodEndTime):</strong> {bruto.periodos.join(" · ")}
                  </p>
                ) : null}
              <pre className="overflow-x-auto rounded-lg border border-linha bg-white p-3 text-xs">{bruto.json}</pre>
              </>
            ) : (
              <p role="alert" className="rounded-md border border-laranja bg-laranja-claro p-3 text-sm">{bruto.erro}</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
