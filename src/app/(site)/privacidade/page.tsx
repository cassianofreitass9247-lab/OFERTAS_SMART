import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho, Conteudo } from "@/components/site/Cabecalho";
import { CONTATO_EMAIL, NOME_SITE, RESPONSAVEL } from "@/lib/config";

export const metadata: Metadata = { title: "Política de privacidade", alternates: { canonical: "/privacidade" } };

export default function PaginaPrivacidade() {
  return (
    <>
      <Cabecalho titulo="Política de privacidade" />
      <Conteudo estreito>
        <div className="prosa">
          <p>
            Esta página explica, de forma direta, quais dados a {NOME_SITE} trata. Ela segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
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
              <strong>Cliques em ofertas:</strong> quando você clica em “Ver na Shopee”, guardamos qual produto foi clicado, a data e, se houver, o canal de
              origem (por exemplo, “instagram”). Não guardamos endereço IP, nome, e-mail nem identificador do seu aparelho junto com o clique.
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
            <li>Não usa cookies de publicidade nem ferramentas de rastreamento de terceiros. O único cookie do site é o de login da administração.</li>
            <li>Não vende nem compartilha dados de visitantes.</li>
          </ul>

          <h2>Ao sair para a Shopee, o Instagram ou o WhatsApp</h2>
          <p>
            Esses serviços têm as próprias políticas de privacidade. A Shopee pode usar cookies para identificar que a visita veio de um link de afiliado.
            O que acontece lá é de responsabilidade de cada serviço.
          </p>

          <h2>Seus direitos</h2>
          <p>
            Você pode pedir confirmação, acesso, correção ou exclusão de dados pessoais pelo canal de contato. Como os cliques são guardados sem
            identificação, normalmente não há dados pessoais seus armazenados pelo site.
          </p>

          <h2>Mudanças nesta política</h2>
          <p>Se o site passar a usar novas ferramentas (por exemplo, estatísticas de visitas), esta página será atualizada antes.</p>
        </div>
      </Conteudo>
    </>
  );
}
