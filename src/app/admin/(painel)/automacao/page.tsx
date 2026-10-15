import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/components/admin/Aviso";
import { configShopee } from "@/lib/shopee";
import { clienteServidor } from "@/lib/supabase/servidor";
import { NOMES_DIAS_CURTOS, proximaExecucao } from "@/lib/automacao";
import { alternarAutomacao, rodarAutomacaoAgora, salvarAgenda, salvarAutomacao } from "../../automacao-acoes";

export const metadata: Metadata = { title: "Automação" };

export default async function PaginaAutomacao({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const cfg = configShopee();
  const sb = await clienteServidor();
  const { data: c, error } = await sb.from("automacao_config").select("*").eq("id", 1).maybeSingle();
  const { data: hoje } = c ? await sb.rpc("automacao_criados_hoje") : { data: 0 };
  const { data: cats } = await sb.from("categorias").select("nome").eq("ativa", true).order("nome");

  const dias = c?.dias_semana ?? [0, 1, 2, 3, 4, 5, 6];
  const hora = c?.hora_execucao ?? 9;
  const migracaoAgenda = !!c && c.dias_semana === undefined;
  const proxima = c && !migracaoAgenda ? proximaExecucao(dias, hora, Date.now(), c.ultima_agendada) : null;

  return (
    <>
      <h1 className="mb-1 font-titulo text-3xl font-extrabold">Automação</h1>
      <p className="mb-4 max-w-[75ch] text-sm text-cinza">
        Uma vez por dia, nos dias e na hora que você escolher (horário de Brasília), o site busca na Shopee os <strong>mais vendidos e com maior desconto</strong> de cada categoria que já existe e
        publica sozinho, já disponível, até o limite diário. Só entram produtos com foto, preço e sem termo sensível no nome. Tudo fica registrado em{" "}
        <Link href="/admin/shopee/lote" className="underline">Importar em lote</Link>, com o botão &ldquo;Desfazer lote&rdquo;.
      </p>
      <Aviso parametros={p} />

      {error || !c ? (
        <p role="alert" className="rounded-md border border-laranja bg-laranja-claro p-3 text-sm">
          O modo automático precisa da migração <code>0006_automacao.sql</code> no Supabase (arquivo em <code>supabase/migrations</code>).
        </p>
      ) : (
        <>
          {!cfg.ativo && (
            <p role="alert" className="mb-4 rounded-md border border-laranja bg-laranja-claro p-3 text-sm">
              A integração com a Shopee não está configurada no Worker (<code>SHOPEE_APP_ID</code> e <code>SHOPEE_SECRET</code>). Sem ela a automação não roda.
            </p>
          )}

          <section aria-label="Situação" className="mb-6 rounded-lg border border-linha bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-lg font-extrabold" data-testid="situacao">
                {c.ativo ? "Ligada" : "Pausada"}
              </p>
              <form action={alternarAutomacao}>
                <input type="hidden" name="ativo" value={String(!c.ativo)} />
                <button type="submit" className={c.ativo ? "botao-secundario" : "botao"}>{c.ativo ? "Pausar" : "Ligar automação"}</button>
              </form>
              <form action={rodarAutomacaoAgora}>
                <button type="submit" className="botao-secundario" disabled={!c.ativo}>Rodar agora</button>
              </form>
            </div>
            {c.pausado_motivo && <p className="mt-2 text-sm font-semibold">Pausou sozinha: {c.pausado_motivo}</p>}
            <p className="mt-2 text-sm" data-testid="hoje">Hoje: <strong>{hoje ?? 0}</strong> de {c.limite_diario} produtos publicados pela automação.</p>
            <p className="mt-1 text-sm text-cinza">
              Última execução:{" "}
              {c.ultima_execucao
                ? `${new Date(c.ultima_execucao).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })} — ${c.ultimo_resultado ?? ""}`
                : "ainda não rodou"}
            </p>
            <p className="mt-1 text-sm text-cinza">
              Categorias buscadas: {cats?.length ? cats.map((x) => x.nome).join(", ") : "nenhuma ativa"}. A cada execução são consultadas 6, em rodízio. Depois de 3 falhas seguidas ela pausa sozinha.
            </p>
          </section>

          {migracaoAgenda ? (
            <p role="alert" className="mb-6 rounded-md border border-laranja bg-laranja-claro p-3 text-sm">
              Para escolher dias e hora falta a migração <code>0008_automacao_agenda.sql</code> no Supabase (arquivo em <code>supabase/migrations</code>).
            </p>
          ) : (
            <form action={salvarAgenda} className="mb-6 rounded-lg border border-linha bg-white p-4" data-testid="agenda">
              <h2 className="font-titulo text-xl font-extrabold">Quando roda</h2>
              <fieldset className="mt-3">
                <legend className="rotulo">Dias da semana</legend>
                <div className="flex flex-wrap gap-2">
                  {NOMES_DIAS_CURTOS.map((nome, i) => (
                    <label key={nome} className="flex cursor-pointer items-center gap-2 rounded-md border border-linha px-3 py-2 text-sm font-semibold has-[:checked]:border-tinta has-[:checked]:bg-neon">
                      <input type="checkbox" name="dia" value={i} defaultChecked={dias.includes(i)} className="size-4" />
                      {nome}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="hora" className="rotulo">Hora (Brasília)</label>
                  <select id="hora" name="hora" defaultValue={hora} className="campo">
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, "0")}h</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="botao">Salvar agenda</button>
              </div>
              <p className="mt-3 text-sm" data-testid="proxima">
                Próxima execução: <strong>{!c.ativo ? "automação pausada" : proxima ? proxima.texto : "nenhuma (marque ao menos um dia)"}</strong>
              </p>
              <p className="mt-1 max-w-[75ch] text-xs text-cinza">
                O site confere de hora em hora e roda uma vez por dia escolhido, a partir da hora marcada. Se você marcar uma hora que já passou hoje e ele ainda não rodou, roda na próxima hora cheia.
                O botão &ldquo;Rodar agora&rdquo; não conta como a execução do dia.
              </p>
            </form>
          )}

          <form action={salvarAutomacao} className="grid gap-3 rounded-lg border border-linha bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
            <h2 className="font-titulo text-xl font-extrabold sm:col-span-2 lg:col-span-3">Limites e filtros</h2>
            <div>
              <label htmlFor="limite_diario" className="rotulo">Produtos por dia (1 a 60)</label>
              <input id="limite_diario" name="limite_diario" type="number" min={1} max={60} defaultValue={c.limite_diario} className="campo" />
            </div>
            <div>
              <label htmlFor="vendas_min" className="rotulo">Vendas mínimas</label>
              <input id="vendas_min" name="vendas_min" type="number" min={0} defaultValue={c.vendas_min} className="campo" />
            </div>
            <div>
              <label htmlFor="nota_min" className="rotulo">Nota mínima (0–5)</label>
              <input id="nota_min" name="nota_min" type="number" min={0} max={5} step="0.1" defaultValue={c.nota_min} className="campo" />
            </div>
            <div>
              <label htmlFor="desconto_min" className="rotulo">Desconto mínimo (%)</label>
              <input id="desconto_min" name="desconto_min" type="number" min={0} max={100} defaultValue={c.desconto_min} className="campo" />
            </div>
            <div>
              <label htmlFor="comissao_min" className="rotulo">Comissão mínima (%)</label>
              <input id="comissao_min" name="comissao_min" type="number" min={0} max={100} step="0.1" defaultValue={c.comissao_min} className="campo" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="botao">Salvar</button>
            </div>
          </form>
          <p className="mt-3 max-w-[75ch] text-xs text-cinza">
            O limite diário também é imposto pelo banco de dados. Desfazer um lote não libera cota no mesmo dia. A &ldquo;maior desconto&rdquo; vale entre os produtos mais vendidos que a Shopee devolve, porque a API não ordena por desconto.
          </p>
        </>
      )}
    </>
  );
}
