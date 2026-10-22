// Gráficos do Resumo do painel. Desenhados no servidor, em SVG e HTML simples, sem biblioteca de gráficos
// (não pesa no site e não usa JavaScript no navegador). Cada gráfico tem texto equivalente para leitor de tela.
import type { ReactNode } from "react";

const COR = "#ff5b14";
const COR_FORTE = "#1e120c";
const COR_SUAVE = "#ffb48f";

export function CartaoGrafico({ id, titulo, subtitulo, children }: { id: string; titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-linha bg-white p-4 sm:p-5">
      <h2 id={id} className="font-titulo text-lg font-bold">{titulo}</h2>
      {subtitulo && <p className="mb-3 text-sm text-cinza">{subtitulo}</p>}
      {children}
    </section>
  );
}

export function SemDados({ texto = "Ainda não há cliques neste período." }: { texto?: string }) {
  return <p className="rounded-lg border border-dashed border-linha p-4 text-sm text-cinza">{texto}</p>;
}

function dataCurta(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Cliques por dia: área com linha. */
export function GraficoLinha({ dados }: { dados: { dia: string; cliques: number }[] }) {
  const L = 760;
  const A = 220;
  const ESQ = 36;
  const DIR = 12;
  const TOPO = 12;
  const BASE = 28;
  const max = Math.max(1, ...dados.map((d) => d.cliques));
  const teto = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const x = (i: number) => ESQ + (dados.length <= 1 ? 0 : (i * (L - ESQ - DIR)) / (dados.length - 1));
  const y = (v: number) => A - BASE - (v / teto) * (A - BASE - TOPO);
  const pontos = dados.map((d, i) => `${x(i).toFixed(1)},${y(d.cliques).toFixed(1)}`);
  const area = `M${x(0).toFixed(1)},${A - BASE} L${pontos.join(" L")} L${x(dados.length - 1).toFixed(1)},${A - BASE} Z`;
  const total = dados.reduce((s, d) => s + d.cliques, 0);
  const melhor = dados.reduce((m, d) => (d.cliques > m.cliques ? d : m), dados[0]);
  const passos = dados.length <= 10 ? 1 : Math.ceil(dados.length / 5);
  return (
    <div className="overflow-x-auto">
    <svg
      viewBox={`0 0 ${L} ${A}`}
      role="img"
      aria-label={`Cliques por dia: ${total} no período, de ${dataCurta(dados[0].dia)} a ${dataCurta(dados[dados.length - 1].dia)}. Maior dia: ${dataCurta(melhor.dia)}, com ${melhor.cliques}.`}
      className="h-auto w-full min-w-[560px]"
    >
      <defs>
        <linearGradient id="grad-linha" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={COR} stopOpacity=".3" />
          <stop offset="1" stopColor={COR} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((k) => (
        <g key={k}>
          <line x1={ESQ} x2={L - DIR} y1={y((teto * k) / 4)} y2={y((teto * k) / 4)} stroke="#e8ddd6" />
          <text x={ESQ - 6} y={y((teto * k) / 4) + 4} textAnchor="end" fontSize="11" fill="#5a4a42">{Math.round((teto * k) / 4)}</text>
        </g>
      ))}
      <path d={area} fill="url(#grad-linha)" />
      <polyline points={pontos.join(" ")} fill="none" stroke={COR} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {dados.length <= 31 && dados.map((d, i) => (d.cliques > 0 ? <circle key={d.dia} cx={x(i)} cy={y(d.cliques)} r="3" fill={COR}><title>{`${dataCurta(d.dia)}: ${d.cliques}`}</title></circle> : null))}
      {dados.map((d, i) =>
        i % passos === 0 || i === dados.length - 1 ? (
          <text key={d.dia} x={x(i)} y={A - 8} textAnchor={i === 0 ? "start" : i === dados.length - 1 ? "end" : "middle"} fontSize="11" fill="#5a4a42">
            {dataCurta(d.dia)}
          </text>
        ) : null,
      )}
    </svg>
    </div>
  );
}

/** Colunas com valor em cima. O maior fica escuro. */
export function GraficoColunas({ dados, rotuloAcessivel }: { dados: { rotulo: string; nome: string; cliques: number }[]; rotuloAcessivel: string }) {
  const max = Math.max(1, ...dados.map((d) => d.cliques));
  return (
    <div role="img" aria-label={`${rotuloAcessivel}: ${dados.map((d) => `${d.nome} ${d.cliques}`).join(", ")}.`} className="flex h-52 items-end gap-2 sm:gap-3">
      {dados.map((d) => (
        <div key={d.rotulo} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 text-xs">
          <b className="preco">{d.cliques}</b>
          <div
            className="w-full rounded-t-lg"
            style={{ height: `${Math.max(d.cliques > 0 ? 4 : 1, (d.cliques / max) * 100 * 0.78)}%`, background: d.cliques === max && max > 0 ? COR_FORTE : COR }}
          />
          <span className="font-bold text-cinza">{d.rotulo}</span>
        </div>
      ))}
    </div>
  );
}

/** 24 barras finas, de 0h a 23h. O horário de maior valor fica escuro. */
export function GraficoHoras({ dados }: { dados: { hora: number; cliques: number }[] }) {
  const max = Math.max(1, ...dados.map((d) => d.cliques));
  return (
    <div>
      <div
        role="img"
        aria-label={`Cliques por horário: ${dados.filter((d) => d.cliques > 0).map((d) => `${d.hora}h ${d.cliques}`).join(", ") || "nenhum"}.`}
        className="flex h-24 items-end gap-[3px]"
      >
        {dados.map((d) => (
          <div
            key={d.hora}
            title={`${d.hora}h: ${d.cliques}`}
            className="flex-1 rounded-t"
            style={{ height: `${Math.max(d.cliques > 0 ? 4 : 1, (d.cliques / max) * 100)}%`, background: d.cliques === max && max > 0 ? COR_FORTE : COR_SUAVE }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-cinza" aria-hidden="true">
        <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
      </div>
    </div>
  );
}

/** Barras horizontais com nome, barra e valor. `href` opcional para o nome virar link. */
export function BarrasHorizontais({
  itens,
  cor = COR,
}: {
  itens: { chave: string; rotulo: string; valor: number; href?: string }[];
  cor?: string;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ol className="space-y-2 text-sm">
      {itens.map((i, n) => (
        <li key={i.chave} className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-2 sm:grid-cols-[minmax(0,14rem)_1fr_2.5rem]">
          <span className="truncate font-semibold" title={i.rotulo}>
            {n + 1}. {i.href ? <a href={i.href} className="underline">{i.rotulo}</a> : i.rotulo}
          </span>
          <span className="h-4 rounded-md bg-laranja-claro" aria-hidden="true">
            <span className="block h-full rounded-md" style={{ width: `${(i.valor / max) * 100}%`, background: cor }} />
          </span>
          <b className="preco text-right">{i.valor}</b>
        </li>
      ))}
    </ol>
  );
}
