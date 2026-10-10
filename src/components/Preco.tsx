import { formatarPreco } from "@/lib/texto";

type Props = { atual: number; anterior: number | null; desconto: number | null; grande?: boolean };

/** Preço atual e, somente quando há queda registrada, o "de" riscado com a etiqueta de desconto. */
export function Preco({ atual, anterior, desconto, grande }: Props) {
  const temDesconto = anterior !== null && desconto !== null && desconto > 0;
  return (
    <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
      <div>
        {temDesconto && (
          <p className={`text-cinza line-through ${grande ? "text-base" : "text-xs"}`}>
            <span className="sr-only">Preço anterior registrado: </span>
            {formatarPreco(anterior)}
          </p>
        )}
        <p className={`preco font-extrabold text-tinta ${grande ? "text-4xl" : "text-xl"}`}>{formatarPreco(atual)}</p>
      </div>
      {temDesconto && (
        <span className={`etiqueta preco mb-0.5 bg-laranja pr-2 font-extrabold text-tinta ${grande ? "py-1 text-lg" : "py-0.5 text-sm"}`}>
          <span className="sr-only">Desconto de {desconto}%</span>
          <span aria-hidden="true">-{desconto}%</span>
        </span>
      )}
    </div>
  );
}
