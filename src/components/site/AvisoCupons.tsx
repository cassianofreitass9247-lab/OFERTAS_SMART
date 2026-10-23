import Link from "next/link";
import { IconeSeta } from "@/components/site/Icones";

/**
 * Aviso genérico de que há cupons vigentes. Não mostra valor nem regra de nenhum cupom: o link leva a /cupons,
 * onde cada um aparece com suas condições. Quem decide se ele aparece é quem o usa (só com cupom vigente no banco).
 */
export function AvisoCupons() {
  return (
    <section id="cupons" className="mx-auto max-w-7xl scroll-mt-48 px-4 pt-16 pb-4 sm:px-8 lg:pt-24">
      <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-6 rounded-[30px] border-[3px] border-tinta bg-neon p-8 shadow-duro sm:p-10">
        <div className="min-w-0 flex-[1_1_420px]">
          <p className="mb-3 inline-block rounded-full border-2 border-tinta bg-white px-3.5 py-1 text-sm font-extrabold">Cupons Shopee</p>
          <h2 className="font-titulo text-3xl leading-tight font-extrabold tracking-[-0.03em] sm:text-4xl">Tem cupom disponível agora</h2>
          <p className="mt-3 max-w-[52ch] text-lg leading-relaxed font-medium">
            Veja todos, com as regras e o prazo de cada um, antes de finalizar a compra na Shopee.
          </p>
        </div>
        <Link href="/cupons" className="vm-btn vm-pilula min-h-14 border-tinta bg-tinta px-7 text-lg font-extrabold text-white shadow-[5px_5px_0_#ffffff]">
          Ver os cupons
          <IconeSeta />
        </Link>
      </div>
    </section>
  );
}
