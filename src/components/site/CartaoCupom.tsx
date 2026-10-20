import { IconeSaida } from "@/components/site/Icones";
import { beneficio, regra, validade } from "@/lib/cupom";
import type { Cupom } from "@/lib/database.types";
import { BotaoCopiarCupom } from "./BotaoCopiarCupom";

type Props = { cupom: Cupom; categoria?: string; compacto?: boolean };

export function CartaoCupom({ cupom, categoria, compacto = false }: Props) {
  const val = validade(cupom.valido_ate);
  const linhaRegra = regra(cupom);
  return (
    <li className="vm-cartao flex flex-col overflow-hidden rounded-3xl border-[2.5px] border-tinta bg-white">
      <div className="flex items-center justify-between gap-3 border-b-[2.5px] border-tinta bg-neon px-4 py-3">
        <p className="font-titulo text-3xl leading-none font-extrabold tracking-[-0.03em]">{beneficio(cupom)}</p>
        <span
          className={`rounded-full border-2 border-tinta px-2.5 py-1 text-xs font-extrabold ${val.urgente ? "bg-sol" : "bg-white"}`}
        >
          {val.texto}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="text-[17px] leading-snug font-bold">{cupom.titulo}</h3>
        {linhaRegra && <p className="text-sm font-semibold text-cinza">{linhaRegra}</p>}
        {!compacto && cupom.descricao && <p className="text-sm leading-relaxed whitespace-pre-line">{cupom.descricao}</p>}
        {categoria && (
          <p className="self-start rounded-full border-2 border-tinta bg-pessego px-2.5 py-0.5 text-xs font-bold">Vale para {categoria}</p>
        )}
        <div className="mt-auto flex flex-col gap-2.5 pt-1">
          {cupom.codigo && <BotaoCopiarCupom id={cupom.id} codigo={cupom.codigo} />}
          {cupom.link_resgate && (
            <a
              href={`/cupom/${cupom.id}`}
              target="_blank"
              rel="nofollow sponsored noopener"
              className="vm-btn vm-pilula min-h-12 justify-center bg-sol px-5 font-extrabold text-tinta"
            >
              {cupom.codigo ? "Abrir na Shopee" : "Resgatar na Shopee"}
              <IconeSaida />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
