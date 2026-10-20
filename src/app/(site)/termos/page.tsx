import type { Metadata } from "next";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import Link from "next/link";
import { F } from "@/lib/marca";

export const metadata: Metadata = { title: "Termos de uso", alternates: { canonical: "/termos" } };

export default function PaginaTermos() {
  return (
    <>
      <Cabecalho titulo="Termos de uso" />
      <Conteudo estreito>
      <div className="prosa">
      <p>Ao usar {F.site}, você concorda com as condições abaixo.</p>

      <h2>O que o site é</h2>
      <p>
        {F.siteComArtigo} divulga ofertas de produtos vendidos na Shopee. O site não vende produtos, não processa pagamentos e não faz entregas. Toda compra é
        feita na Shopee, com as regras da Shopee e do vendedor.
      </p>

      <h2>Preços e disponibilidade</h2>
      <p>
        As informações são registradas em datas específicas e podem estar desatualizadas. Preço, frete, estoque e condições válidos são sempre os
        exibidos na Shopee no momento da compra. Antes de comprar, confira os dados na página do vendedor.
      </p>

      <h2>Links de afiliado</h2>
      <p>
        O site pode receber comissão por compras feitas a partir dos seus links. Veja os detalhes em{" "}
        <Link href="/afiliados">Como funcionam os links de afiliado</Link>.
      </p>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Problemas com pedido, entrega, troca, devolução ou garantia devem ser tratados com a Shopee e com o vendedor.</li>
        <li>O site se esforça para manter as informações corretas, mas não garante que estejam livres de erros.</li>
        <li>Marcas e imagens de produtos pertencem aos respectivos donos.</li>
      </ul>

      <h2>Contato</h2>
      <p>
        Encontrou uma informação errada? Avise pela página <Link href="/contato">Contato</Link>.
      </p>
    </div>
      </Conteudo>
    </>
  );
}
