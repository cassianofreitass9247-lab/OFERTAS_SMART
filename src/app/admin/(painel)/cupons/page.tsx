import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/components/admin/Aviso";
import { FormularioCupom } from "@/components/admin/FormularioCupom";
import { beneficio, regra } from "@/lib/cupom";
import { EH_UUID, formatarData } from "@/lib/texto";
import { clienteServidor } from "@/lib/supabase/servidor";
import { alternarCupom, excluirCupom } from "../../acoes";

export const metadata: Metadata = { title: "Cupons" };

type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PaginaCuponsAdmin({ searchParams }: { searchParams: Promise<Busca> }) {
  const parametros = await searchParams;
  const sb = await clienteServidor();
  const [{ data, error }, { data: cats }] = await Promise.all([
    sb.from("cupons").select("*").order("valido_ate", { ascending: false }),
    sb.from("categorias").select("id, nome").order("nome"),
  ]);
  const cupons = data ?? [];
  const categorias = cats ?? [];
  const nomeCat = new Map(categorias.map((c) => [c.id, c.nome]));
  const idEdicao = um(parametros.editar);
  const emEdicao = idEdicao && EH_UUID.test(idEdicao) ? cupons.find((c) => c.id === idEdicao) : undefined;
  const agora = Date.now();

  return (
    <>
      <h1 className="mb-4 font-titulo text-3xl font-extrabold">Cupons</h1>
      <Aviso parametros={parametros} />
      {error && (
        <p role="alert" className="mb-4 rounded-md border border-laranja bg-laranja-claro p-3 text-sm">
          Não foi possível listar: {error.message}. Se for a primeira vez, aplique a migração 0010 no Supabase.
        </p>
      )}

      <FormularioCupom key={emEdicao?.id ?? "novo"} cupom={emEdicao} categorias={categorias} />

      {cupons.length === 0 ? (
        <p className="rounded-lg border border-dashed border-linha bg-white p-8 text-center">
          Nenhum cupom ainda. Veja os cupons exclusivos na aba “Vouchers” do portal de afiliados da Shopee e cadastre acima.
        </p>
      ) : (
        <ul className="divide-y divide-linha rounded-lg border border-linha bg-white">
          {cupons.map((c) => {
            const vencido = new Date(c.valido_ate).getTime() <= agora;
            const futuro = new Date(c.valido_de).getTime() > agora;
            const situacao = !c.ativo ? "oculto" : vencido ? "vencido" : futuro ? `começa em ${formatarData(c.valido_de)}` : "no ar";
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-semibold">
                    {c.titulo} <span className="ml-1 rounded bg-pessego px-1.5 py-0.5 text-xs font-bold">{beneficio(c)}</span>
                    {c.destaque && <span className="ml-1 rounded bg-sol px-1.5 py-0.5 text-xs font-bold">destaque</span>}
                  </p>
                  <p className="text-sm text-cinza">
                    {c.codigo ? <>Código <code className="font-mono font-bold text-tinta">{c.codigo}</code>, </> : null}
                    {c.link_resgate ? "com link, " : ""}
                    {regra(c) ? `${regra(c)}, ` : ""}
                    {c.categoria_id ? `${nomeCat.get(c.categoria_id) ?? "categoria"}, ` : ""}
                    até {formatarData(c.valido_ate)}
                  </p>
                  <p className="text-sm text-cinza">
                    <strong className={situacao === "no ar" ? "text-tinta" : ""}>{situacao}</strong>, {c.cliques} {c.cliques === 1 ? "uso" : "usos"}
                  </p>
                </div>
                <Link href={`/admin/cupons?editar=${c.id}`} className="botao-secundario py-1.5">Editar</Link>
                <form action={alternarCupom}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="ativo" value={String(!c.ativo)} />
                  <button type="submit" className="botao-secundario py-1.5">{c.ativo ? "Ocultar do site" : "Reativar"}</button>
                </form>
                <form action={excluirCupom}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="text-sm underline">Excluir</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-sm text-cinza">
        “Usos” somam os cliques no link de resgate e as cópias do código. Cupom vencido some do site sozinho; pode excluir quando quiser limpar a lista.
      </p>
    </>
  );
}
