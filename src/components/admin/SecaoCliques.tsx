import Link from "next/link";
import { CartaoGrafico, GraficoColunas, GraficoHoras, GraficoLinha, SemDados } from "@/components/admin/Graficos";
import { cliquesPorDiaCompleto, janelaDePico, lider, percentual, PERIODOS, porDiaDaSemana, porHora, variacaoPercentual, type Periodo, type ResumoCliques } from "@/lib/estatisticas";

/** Seção "Cliques" do Resumo: cartões, gráficos por dia, dia da semana e horário. */
export function SecaoCliques({
  periodo,
  resumo,
  erro,
  produtoLider,
}: {
  periodo: Periodo;
  resumo: ResumoCliques;
  erro: boolean;
  produtoLider: { nome: string; cliques: number } | null;
}) {
  const semana = porDiaDaSemana(resumo);
  const horas = porHora(resumo);
  const diaLider = lider(semana);
  const pico = janelaDePico(horas);
  const variacao = variacaoPercentual(resumo.total, resumo.anterior);
  const fimDeSemana = semana.filter((d) => d.rotulo === "Sáb" || d.rotulo === "Dom").reduce((s, d) => s + d.cliques, 0);
  return (
    <section aria-labelledby="t-cliques" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="t-cliques" className="font-titulo text-2xl font-extrabold">Cliques</h2>
          <nav aria-label="Período" className="flex overflow-hidden rounded-full border-2 border-tinta text-sm font-bold">
            {PERIODOS.map((d) => (
              <Link key={d} href={`/admin?periodo=${d}`} aria-current={d === periodo ? "page" : undefined} className={`px-4 py-2 no-underline ${d === periodo ? "bg-tinta text-white" : "text-tinta"}`}>
                {d} dias
              </Link>
            ))}
          </nav>
        </div>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-linha bg-white p-4">
            <dt className="text-sm text-cinza">Cliques em {periodo} dias</dt>
            <dd className="preco text-3xl font-extrabold">{erro ? "?" : resumo.total}</dd>
            <dd className="text-sm font-bold text-cinza">
              {variacao === null ? "Sem período anterior para comparar" : `${variacao >= 0 ? "▲" : "▼"} ${Math.abs(variacao)}% em relação aos ${periodo} dias anteriores`}
            </dd>
          </div>
          <div className="rounded-lg border border-linha bg-white p-4">
            <dt className="text-sm text-cinza">Dia da semana com mais cliques</dt>
            <dd className="font-titulo text-2xl font-extrabold">{diaLider?.nome ?? "—"}</dd>
            {diaLider && <dd className="text-sm font-bold text-cinza">{percentual(diaLider.cliques, resumo.total)}% do total</dd>}
          </div>
          <div className="rounded-lg border border-linha bg-white p-4">
            <dt className="text-sm text-cinza">Horário de pico</dt>
            <dd className="font-titulo text-2xl font-extrabold">{pico?.rotulo ?? "—"}</dd>
            {pico && <dd className="text-sm font-bold text-cinza">{percentual(pico.cliques, resumo.total)}% dos cliques</dd>}
          </div>
          <div className="rounded-lg border border-linha bg-white p-4">
            <dt className="text-sm text-cinza">Produto mais clicado</dt>
            <dd className="line-clamp-2 font-titulo text-lg leading-tight font-extrabold">{produtoLider?.nome ?? "—"}</dd>
            {produtoLider && <dd className="text-sm font-bold text-cinza">{produtoLider.cliques} cliques</dd>}
          </div>
        </dl>

        {resumo.total === 0 ? (
          <SemDados />
        ) : (
          <>
            <CartaoGrafico id="t-g-dia" titulo="Cliques por dia" subtitulo={`Últimos ${periodo} dias, no horário de Mossoró`}>
              <GraficoLinha dados={cliquesPorDiaCompleto(resumo)} />
            </CartaoGrafico>
            <div className="grid gap-4 md:grid-cols-2">
              <CartaoGrafico id="t-g-semana" titulo="Cliques por dia da semana" subtitulo="Soma do período">
                <GraficoColunas dados={semana} rotuloAcessivel="Cliques por dia da semana" />
                {resumo.total < 100 ? (
                  <p className="mt-3 rounded-md border-l-4 border-neon bg-laranja-claro p-2 text-sm font-semibold">
                    Ainda há poucos cliques ({resumo.total}). Só tire conclusões de dia e horário quando passar de algumas centenas.
                  </p>
                ) : (
                  diaLider && (
                    <p className="mt-3 rounded-md border-l-4 border-neon bg-laranja-claro p-2 text-sm font-semibold">
                      {diaLider.nome} lidera. Sábado e domingo juntos: {percentual(fimDeSemana, resumo.total)}% dos cliques.
                    </p>
                  )
                )}
              </CartaoGrafico>
              <CartaoGrafico id="t-g-hora" titulo="Cliques por horário" subtitulo="Soma do período, de 0h a 23h">
                <GraficoHoras dados={horas} />
                {pico && (
                  <p className="mt-3 rounded-md border-l-4 border-neon bg-laranja-claro p-2 text-sm font-semibold">Faixa de 3 horas com mais cliques: {pico.rotulo}.</p>
                )}
              </CartaoGrafico>
            </div>
          </>
        )}
      </section>
  );
}
