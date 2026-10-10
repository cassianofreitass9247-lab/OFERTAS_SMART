import type { Metadata } from "next";
import { CONTATO_EMAIL } from "@/lib/config";

export const metadata: Metadata = { title: "Contato", alternates: { canonical: "/contato" } };

export default function PaginaContato() {
  return (
    <div className="prosa max-w-[70ch]">
      <h1 className="font-titulo text-3xl font-extrabold">Contato</h1>
      {CONTATO_EMAIL ? (
        <p className="mt-3">
          Para avisar sobre um preço errado, uma oferta fora do ar ou tratar de privacidade, escreva para{" "}
          <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>.
        </p>
      ) : (
        <p className="mt-3">O e-mail de contato ainda não foi configurado pelo responsável do site.</p>
      )}
      <p>Dúvidas sobre pedido, pagamento ou entrega devem ser resolvidas diretamente na Shopee, onde a compra foi feita.</p>
    </div>
  );
}
