import { formatarPreco } from "@/lib/texto";

type Props = { atual: number; anterior: number | null; desconto: number | null; grande?: boolean };

/** Preço atual e, só quando há queda registrada, o "de" riscado. O selo de % fica na imagem. */
export function Preco({ atual, anterior, desconto, grande }: Props) {
  const temDesconto = anterior !== null && desconto !== null && desconto > 0;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
      <p className={`preco font-extrabold text-tinta ${grande ? "text-5xl sm:text-6xl" : "text-2xl"}`}>{formatarPreco(atual)}</p>
      {temDesconto && (
        <p className={`text-cinza line-through ${grande ? "text-lg" : "text-[13px]"}`}>
          <span className="sr-only">Preço anterior registrado: </span>
          de {formatarPreco(anterior)}
        </p>
      )}
    </div>
  );
}

export function SeloDesconto({ desconto, grande }: { desconto: number; grande?: boolean }) {
  if (grande) {
    return (
      <span className="vm-flutua preco flex size-24 items-center justify-center rounded-full border-[3px] border-tinta bg-sol text-3xl font-extrabold text-tinta shadow-duro-p sm:size-28 sm:text-4xl" style={{ ["--r" as string]: "10deg" }}>
        <span className="sr-only">Desconto de {desconto}%</span>
        <span aria-hidden="true">-{desconto}%</span>
      </span>
    );
  }
  return (
    <span className="preco rounded-lg border-2 border-tinta bg-neon px-2 py-0.5 text-base font-extrabold text-tinta">
      <span className="sr-only">Desconto de {desconto}%</span>
      <span aria-hidden="true">-{desconto}%</span>
    </span>
  );
}
