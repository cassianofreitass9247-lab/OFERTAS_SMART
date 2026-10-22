import Link from "next/link";
import { Aviso } from "@/components/admin/Aviso";
import { CONTATO_EMAIL, RESPONSAVEL, SITE_URL } from "@/lib/config";
import { clienteServidor } from "@/lib/supabase/servidor";
import { formatarDataHora } from "@/lib/texto";
import { configTurnstile } from "@/lib/turnstile";
import { carregarDemo, removerDemo } from "../acoes";
import { MARCA } from "@/lib/marca";
import { BarrasHorizontais } from "@/components/admin/Graficos";
import { SecaoCliques } from "@/components/admin/SecaoCliques";
import { SecaoLocais } from "@/components/admin/SecaoLocais";
import { lerLocais } from "@/lib/local";
import { lerPeriodo, lerResumo } from "@/lib/estatisticas";

export default async function PaginaResumo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sb = await clienteServidor();
  const periodo = lerPeriodo((await searchParams).periodo);
  const contar = (status?: "publicado" | "rascunho" | "despublicado") => {
    const q = sb.from("produtos").select("id", { count: "exact", head: true });
    return status ? q.eq("status_publicacao", status) : q;
  };

  const [publicados, rascunhos, despublicados, ficticios, resumoBruto, locaisBruto, top, canais, importacoes] = await Promise.all([
    contar("publicado"),
    contar("rascunho"),
    contar("despublicado"),
    sb.from("produtos").select("id", { count: "exact", head: true }).eq("ficticio", true),
    sb.rpc("cliques_resumo", { p_dias: periodo }),
    sb.rpc("cliques_locais", { p_dias: periodo }),
    sb.rpc("produtos_mais_clicados", { p_dias: periodo, p_limite: 10 }),
    sb.rpc("cliques_por_canal", { p_dias: periodo }),
    sb.from("importacoes").select("*").order("criado_em", { ascending: false }).limit(5),
  ]);

  const falhou = [publicados, rascunhos, despublicados, ficticios, resumoBruto, locaisBruto, top, canais, importacoes].find((r) => r.error);
  const qtdFicticios = ficticios.count ?? 0;

  const turnstile = configTurnstile();
  const pendencias = [
    turnstile.incompleto &&
      "Proteção contra robôs com configuração incompleta: o formulário de pedidos e o login estão recusando envios. Cadastre TURNSTILE_SITE_KEY e TURNSTILE_SECRET_KEY no Worker.",
    !turnstile.ativo &&
      !turnstile.incompleto &&
      "Proteção contra robôs (Cloudflare Turnstile) desligada no formulário de pedidos e no login. Cadastre TURNSTILE_SITE_KEY e TURNSTILE_SECRET_KEY no Worker.",
    qtdFicticios > 0 && `Há ${qtdFicticios} produtos fictícios no banco. Remova-os antes de divulgar o site.`,
    !CONTATO_EMAIL && "Falta definir o e-mail de contato (variável NEXT_PUBLIC_CONTATO_EMAIL).",
    !RESPONSAVEL && "Falta definir o nome do responsável pelo site, exibido na política de privacidade (variável NEXT_PUBLIC_RESPONSAVEL).",
    ...MARCA.avisos.map((a) => `Marca: ${a}`),
    SITE_URL.includes("localhost") && "Falta definir o endereço público do site (variável NEXT_PUBLIC_SITE_URL).",
  ].filter(Boolean) as string[];

  const numeros = [
    { rotulo: "Publicados", valor: publicados.count },
    { rotulo: "Rascunhos", valor: rascunhos.count },
    { rotulo: "Despublicados", valor: despublicados.count },
  ];
  const resumo = lerResumo(resumoBruto.data, periodo);
  const produtoLider = top.data?.[0];


  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 font-titulo text-3xl font-extrabold">Resumo</h1>
        <Aviso parametros={await searchParams} />
        {falhou?.error && (
          <p role="alert" className="mb-4 rounded-md border border-laranja bg-laranja-claro p-3 text-sm">
            Parte dos números não pôde ser carregada: {falhou.error.message}
          </p>
        )}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {numeros.map((n) => (
            <div key={n.rotulo} className="rounded-lg border border-linha bg-white p-4">
              <dt className="text-sm text-cinza">{n.rotulo}</dt>
              <dd className="preco text-3xl font-extrabold">{n.valor ?? "?"}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-sm text-cinza">
          Cliques são contados pelo site. Vendas e comissões só existem no painel da Shopee e ainda não são exibidas aqui.
        </p>
      </div>

      <SecaoCliques periodo={periodo} resumo={resumo} erro={Boolean(resumoBruto.error)} produtoLider={produtoLider ? { nome: produtoLider.nome, cliques: Number(produtoLider.cliques) } : null} />

      <SecaoLocais periodo={periodo} locais={lerLocais(locaisBruto.data)} erro={Boolean(locaisBruto.error)} />

      {pendencias.length > 0 && (
        <section aria-labelledby="t-pendencias" className="rounded-lg border border-laranja bg-laranja-claro p-4">
          <h2 id="t-pendencias" className="mb-2 font-titulo text-lg font-bold">Pendências</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {pendencias.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </section>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="t-top">
          <h2 id="t-top" className="mb-2 font-titulo text-lg font-bold">Top 10 produtos mais clicados em {periodo} dias</h2>
          {top.data && top.data.length > 0 ? (
            <div className="rounded-lg border border-linha bg-white p-4">
              <BarrasHorizontais itens={top.data.map((t) => ({ chave: t.produto_id, rotulo: t.nome, valor: Number(t.cliques), href: `/admin/produtos/${t.produto_id}` }))} />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-linha bg-white p-4 text-sm text-cinza">Nenhum clique registrado ainda.</p>
          )}
        </section>

        <section aria-labelledby="t-canais">
          <h2 id="t-canais" className="mb-2 font-titulo text-lg font-bold">Cliques por canal e campanha em {periodo} dias</h2>
          {canais.data && canais.data.length > 0 ? (
            <div className="rounded-lg border border-linha bg-white p-4">
              <BarrasHorizontais
                cor="#c2410c"
                itens={canais.data.map((c) => ({ chave: c.canal + "|" + c.campanha, rotulo: c.campanha ? `${c.canal} / ${c.campanha}` : c.canal, valor: Number(c.cliques) }))}
              />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-linha bg-white p-4 text-sm text-cinza">
              Para medir um canal, divulgue o link assim: {SITE_URL}/ir/ID-DO-PRODUTO?canal=telegram
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="t-importacoes">
        <h2 id="t-importacoes" className="mb-2 font-titulo text-lg font-bold">Últimas importações</h2>
        {importacoes.data && importacoes.data.length > 0 ? (
          <ul className="divide-y divide-linha rounded-lg border border-linha bg-white text-sm">
            {importacoes.data.map((i) => (
              <li key={i.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 p-3">
                <span>{formatarDataHora(i.criado_em)}, {i.arquivo_nome ?? "sem nome"}</span>
                <span className="text-cinza">{i.inseridos} novos, {i.atualizados} atualizados, {i.rejeitados} rejeitados</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-linha bg-white p-4 text-sm text-cinza">
            Nenhuma importação feita. <Link href="/admin/importar" className="underline">Importar um arquivo CSV</Link>
          </p>
        )}
      </section>

      <section aria-labelledby="t-demo" className="rounded-lg border border-linha bg-white p-4">
        <h2 id="t-demo" className="font-titulo text-lg font-bold">Dados de demonstração</h2>
        <p className="mt-1 mb-3 max-w-[70ch] text-sm text-cinza">
          Seis produtos fictícios para você ver o site funcionando. Eles aparecem com o aviso “dado fictício”, não têm botão de compra e ficam fora do
          Google. Agora há {qtdFicticios} no banco.
        </p>
        <div className="flex flex-wrap gap-3">
          <form action={carregarDemo}><button type="submit" className="botao-secundario">Carregar produtos fictícios</button></form>
          {qtdFicticios > 0 && <form action={removerDemo}><button type="submit" className="botao">Remover produtos fictícios</button></form>}
        </div>
      </section>
    </div>
  );
}
