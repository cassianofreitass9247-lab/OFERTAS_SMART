import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import { CONTATO_EMAIL, RESPONSAVEL } from "@/lib/config";
import { F } from "@/lib/marca";

export const metadata: Metadata = { title: "Política de privacidade", alternates: { canonical: "/privacidade" } };

export default function PaginaPrivacidade() {
  return (
    <>
      <Cabecalho titulo="Política de privacidade" />
      <Conteudo estreito>
        <div className="prosa">
          <p>
            Esta página explica, de forma direta, quais dados {F.site} trata. Ela segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </p>

          <h2>Quem é o responsável</h2>
          <p>
            {RESPONSAVEL ? <>A responsável pelo site (controladora) é {RESPONSAVEL}.</> : <>O nome do responsável pelo site ainda será informado aqui.</>}{" "}
            {CONTATO_EMAIL ? (
              <>Para qualquer assunto sobre seus dados, escreva para <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>.</>
            ) : (
              <>O canal de contato está na página <Link href="/contato">Contato</Link>.</>
            )}
          </p>

          <h2>O que o site registra</h2>
          <ul>
            <li>
              <strong>Cliques em ofertas:</strong> quando você clica em “Ver na Shopee”, guardamos qual produto foi clicado, a data, se houver, o canal de
              origem (por exemplo, “instagram”) e a sua localização aproximada (país, estado e cidade). Essa localização é estimada pelo provedor de
              hospedagem (Cloudflare) a partir do seu endereço de internet, só no momento do clique, e serve para saber de onde vem o público. Não
              guardamos o endereço IP, nome, e-mail nem identificador do seu aparelho junto com o clique, e a localização pode não ser exata.
            </li>
            <li>
              <strong>Pedidos de produto (“Pede {F.pra}”):</strong> se você fizer um pedido, guardamos seu nome, seu WhatsApp, a descrição do produto e o
              link de exemplo, se você mandar. Servem só para {F.a} procurar o produto e responder você no WhatsApp, inclusive com link de afiliado da
              Shopee. A base é o seu consentimento, dado na caixa de autorização do formulário. Para responder, o site pode separar opções de produto (o texto do seu pedido, sem nome nem WhatsApp, é usado para buscar produtos na Shopee, inclusive
              automaticamente logo depois do envio) e abrir uma página só sua, com um endereço secreto, que mostra seu primeiro nome, o que você pediu e as opções; os links de afiliado dessas opções
              levam um código do pedido, sem seu nome nem seu WhatsApp, para {F.a} saber de qual pedido veio uma compra. Só a administração do site vê o
              nome completo e o WhatsApp, que não são vendidos nem repassados, e tudo é apagado automaticamente em até 90 dias. Você pode pedir a exclusão antes disso pelo canal de contato.
            </li>
            <li>
              <strong>Produtos salvos (coração):</strong> a lista fica guardada só no seu navegador. Ela não é enviada para o site e some se você limpar os
              dados do navegador.
            </li>
            <li>
              <strong>Registros técnicos da hospedagem:</strong> como em qualquer site, o provedor de hospedagem processa endereço IP e dados do navegador
              para entregar as páginas e proteger o serviço.
            </li>
          </ul>

          <h2>O que o site não faz</h2>
          <ul>
            <li>Não pede cadastro nem login de visitantes.</li>
            <li>
              Não carrega vídeos de terceiros sem você pedir. Quando um produto tem vídeo do YouTube, TikTok, Instagram ou Google Drive, o player só é carregado se
              você tocar em “Assistir ao vídeo”. A partir daí vale a política de privacidade desse serviço, que pode usar cookies.
            </li>
            <li>Não usa cookies de publicidade nem ferramentas de rastreamento de terceiros. O único cookie do site é o de login da administração.</li>
            <li>Não vende nem compartilha dados de visitantes.</li>
          </ul>

          <h2>Ao sair para a Shopee, o Instagram, o WhatsApp ou um vídeo</h2>
          <p>
            Esses serviços têm as próprias políticas de privacidade. A Shopee pode usar cookies para identificar que a visita veio de um link de afiliado.
            O que acontece lá é de responsabilidade de cada serviço.
          </p>

          <h2>Seus direitos</h2>
          <p>
            Você pode pedir confirmação, acesso, correção ou exclusão de dados pessoais pelo canal de contato, e pode retirar o consentimento a qualquer
            momento. Os cliques são guardados sem identificação; os únicos dados pessoais que o site guarda são os de pedidos de produto, por até 90 dias.
          </p>

          <h2>Mudanças nesta política</h2>
          <p>Se o site passar a usar novas ferramentas (por exemplo, estatísticas de visitas), esta página será atualizada antes.</p>
        </div>
      </Conteudo>
    </>
  );
}
