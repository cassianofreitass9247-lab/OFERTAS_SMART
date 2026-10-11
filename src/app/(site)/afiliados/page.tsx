import type { Metadata } from "next";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import { NOME_SITE } from "@/lib/config";

export const metadata: Metadata = { title: "Como funcionam os links de afiliado", alternates: { canonical: "/afiliados" } };

export default function PaginaAfiliados() {
  return (
    <>
      <Cabecalho titulo="Como funcionam os links de afiliado" />
      <Conteudo estreito>
      <div className="prosa">
      <p>
        A {NOME_SITE} participa do programa de afiliados da Shopee. Os botões “Ver preço atual na Shopee” são links de afiliado: quando você compra
        depois de clicar em um deles, a Shopee pode pagar uma comissão ao site.
      </p>
      <h2>O que isso muda para você</h2>
      <ul>
        <li>O preço que você paga é o mesmo: a comissão sai da Shopee e do vendedor, não do seu bolso.</li>
        <li>A compra, o pagamento, a entrega e a garantia são tratados diretamente com a Shopee e com o vendedor.</li>
        <li>O site é independente e não pertence à Shopee.</li>
      </ul>
      <h2>Como tratamos preços e descontos</h2>
      <ul>
        <li>O preço exibido é o que registramos na data indicada em cada página. Ele pode ter mudado; vale o preço mostrado na Shopee.</li>
        <li>O preço riscado (“de”) só aparece quando o próprio site registrou um preço maior antes. Não usamos o preço “original” informado pelo anúncio.</li>
        <li>Não garantimos estoque, prazo de entrega nem a continuidade de uma oferta.</li>
      </ul>
    </div>
      </Conteudo>
    </>
  );
}
