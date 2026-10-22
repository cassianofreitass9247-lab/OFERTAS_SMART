import { BarrasHorizontais, CartaoGrafico, SemDados } from "@/components/admin/Graficos";
import { percentual } from "@/lib/estatisticas";
import { rotuloCidade, rotuloEstado, type LocaisCliques } from "@/lib/local";

/** Seção "De onde vêm os cliques": estados e cidades, com aviso de que o local é aproximado. */
export function SecaoLocais({ periodo, locais, erro }: { periodo: number; locais: LocaisCliques; erro: boolean }) {
  const semLocal = locais.total - locais.com_local;
  return (
    <CartaoGrafico
      id="t-locais"
      titulo={`De onde vêm os cliques em ${periodo} dias`}
      subtitulo="Local aproximado, estimado pelo endereço de internet (o endereço não é guardado). Em internet de celular a cidade pode errar. Só conta cliques a partir da ativação deste recurso."
    >
      {erro ? (
        <SemDados texto="Não foi possível carregar o local dos cliques." />
      ) : locais.com_local === 0 ? (
        <SemDados texto="Ainda não há cliques com local neste período. Os próximos cliques passam a aparecer aqui." />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-bold">Estados</h3>
            <BarrasHorizontais itens={locais.por_estado.map((e) => ({ chave: `${e.pais}|${e.estado}`, rotulo: rotuloEstado(e.pais, e.estado), valor: e.cliques }))} />
          </div>
          <div>
            <h3 className="mb-2 font-bold">Cidades (aproximado)</h3>
            {locais.por_cidade.length > 0 ? (
              <BarrasHorizontais
                cor="#ff9a66"
                itens={locais.por_cidade.map((c) => ({ chave: `${c.pais}|${c.estado}|${c.cidade}`, rotulo: rotuloCidade(c.cidade, c.estado, c.pais), valor: c.cliques }))}
              />
            ) : (
              <p className="text-sm text-cinza">Nenhuma cidade identificada.</p>
            )}
          </div>
        </div>
      )}
      {!erro && locais.total > 0 && (
        <p className="mt-3 text-sm text-cinza">
          {locais.com_local} de {locais.total} cliques com local identificado ({percentual(locais.com_local, locais.total)}%).
          {semLocal > 0 && ` ${semLocal} sem local (cliques anteriores à ativação ou local desconhecido).`}
        </p>
      )}
    </CartaoGrafico>
  );
}
