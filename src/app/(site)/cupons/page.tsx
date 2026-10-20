import type { Metadata } from "next";
import Link from "next/link";
import { CartaoCupom } from "@/components/site/CartaoCupom";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import { listarCategorias, listarCupons } from "@/lib/dados";

// Dados ao vivo: o cupom vencido some sozinho (o banco só entrega os vigentes).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cupons da Shopee",
  description: "Cupons e vouchers da Shopee separados pela Moni, com o prazo de validade de cada um.",
  alternates: { canonical: "/cupons" },
};

export default async function PaginaCupons() {
  const [cupons, categorias] = await Promise.all([listarCupons(), listarCategorias()]);
  const nomeDaCategoria = new Map(categorias.map((c) => [c.id, c.nome]));
  return (
    <>
      <Cabecalho
        titulo="Cupons"
        subtitulo="Cupons da Shopee que a Moni separou. Copie o código ou abra o link e aplique na hora de pagar. Cada cupom mostra até quando vale."
      />
      <Conteudo>
        {cupons.length === 0 ? (
          <div className="rounded-3xl border-[2.5px] border-tinta bg-pessego p-6">
            <p className="text-lg font-semibold">Nenhum cupom disponível agora.</p>
            <p className="mt-1">
              Enquanto isso, veja as <Link href="/promocoes" className="font-bold underline decoration-neon decoration-2">promoções do dia</Link>.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cupons.map((c) => (
              <CartaoCupom key={c.id} cupom={c} categoria={c.categoria_id ? nomeDaCategoria.get(c.categoria_id) : undefined} />
            ))}
          </ul>
        )}
        <p className="mt-8 max-w-[70ch] text-sm text-cinza">
          Regras, valor mínimo e prazo de cada cupom são definidos pela Shopee e podem mudar ou acabar antes da data (por limite de uso). Confira as condições
          na hora do pagamento. Alguns links são de afiliado: se você comprar, posso receber uma comissão, sem custo extra para você.
        </p>
      </Conteudo>
    </>
  );
}
