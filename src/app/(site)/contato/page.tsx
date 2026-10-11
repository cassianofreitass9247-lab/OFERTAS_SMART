import type { Metadata } from "next";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import { CONTATO_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Contato", alternates: { canonical: "/contato" } };

export default function PaginaContato() {
  return (
    <>
      <Cabecalho titulo="Contato" />
      <Conteudo estreito>
      <div className="prosa">
      {CONTATO_EMAIL ? (
        <p>
          Para avisar sobre um preço errado, uma oferta fora do ar ou tratar de privacidade, escreva para{" "}
          <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>.
        </p>
      ) : (
        <p>O e-mail de contato ainda não foi configurado pelo responsável do site.</p>
      )}
      <p>Dúvidas sobre pedido, pagamento ou entrega devem ser resolvidas diretamente na Shopee, onde a compra foi feita.</p>
    </div>
      </Conteudo>
    </>
  );
}
