import type { Metadata } from "next";
import Link from "next/link";
import { CONTATO_EMAIL, NOME_SITE, RESPONSAVEL } from "@/lib/config";

export const metadata: Metadata = { title: "Política de privacidade", alternates: { canonical: "/privacidade" } };

export default function PaginaPrivacidade() {
  return (
    <div className="prosa max-w-[70ch]">
      <h1 className="font-titulo text-3xl font-extrabold">Política de privacidade</h1>
      <p className="mt-3">
        Esta página explica, de forma direta, quais dados o {NOME_SITE} trata. Ela segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
      </p>

      <h2>Quem é o responsável</h2>
      <p>
        {RESPONSAVEL ? <>O responsável pelo site (controlador) é {RESPONSAVEL}.</> : <>O nome do responsável pelo site ainda será informado aqui.</>}{" "}
        {CONTATO_EMAIL ? (
          <>Para qualquer assunto sobre seus dados, escreva para <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>.</>
        ) : (
          <>O canal de contato está na página <Link href="/contato">Contato</Link>.</>
        )}
      </p>

      <h2>O que o site registra</h2>
      <ul>
        <li>
          <strong>Cliques em ofertas:</strong> quando você clica em “Ver preço atual na Shopee”, guardamos qual produto foi clicado, a data e, se houver, o
          canal de origem (por exemplo, “telegram”). Não guardamos endereço IP, nome, e-mail nem identificador do seu aparelho junto com o clique.
        </li>
        <li>
          <strong>Registros técnicos da hospedagem:</strong> como em qualquer site, o provedor de hospedagem processa endereço IP e dados do navegador para
          entregar as páginas e proteger o serviço.
        </li>
      </ul>

      <h2>O que o site não faz</h2>
      <ul>
        <li>Não pede cadastro nem login de visitantes.</li>
        <li>Não usa cookies de publicidade nem ferramentas de rastreamento de terceiros. O único cookie do site é o de login do administrador.</li>
        <li>Não vende nem compartilha dados de visitantes.</li>
      </ul>

      <h2>Ao sair para a Shopee</h2>
      <p>
        Ao clicar em uma oferta você é levado à Shopee, que tem a própria política de privacidade e pode usar cookies para identificar que a visita veio
        de um link de afiliado. O que acontece lá é de responsabilidade da Shopee.
      </p>

      <h2>Seus direitos</h2>
      <p>
        Você pode pedir confirmação, acesso, correção ou exclusão de dados pessoais pelo canal de contato. Como os cliques são guardados sem
        identificação, normalmente não há dados pessoais seus armazenados pelo site.
      </p>

      <h2>Mudanças nesta política</h2>
      <p>Se o site passar a usar novas ferramentas (por exemplo, estatísticas de visitas), esta página será atualizada antes.</p>
    </div>
  );
}
