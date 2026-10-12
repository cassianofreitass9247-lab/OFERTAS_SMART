import type { Metadata } from "next";
import { MAX_LINHAS_CSV } from "@/lib/produto";
import { FormularioImportacao } from "./FormularioImportacao";

export const metadata: Metadata = { title: "Importar CSV" };

const COLUNAS = [
  ["nome", "Obrigatória", "Nome do produto, de 3 a 200 caracteres."],
  ["link_afiliado", "Obrigatória", "Link gerado no painel de afiliados da Shopee."],
  ["preco_atual", "Obrigatória", "Preço de hoje. Aceita 59,90 ou 1.234,56."],
  ["categoria", "Opcional", "Nome da categoria. Se não existir, é criada."],
  ["descricao", "Opcional", "Texto sobre o produto."],
  ["imagem_url", "Opcional", "Endereço da imagem, começando com https://."],
  ["video_url", "Opcional", "Link do vídeo: YouTube, TikTok (inclusive link curto, até 10 por arquivo), Instagram, Google Drive, Shopee Video ou arquivo .mp4."],
  ["id_externo", "Opcional", "ID do produto na Shopee. Ajuda a reconhecer o mesmo produto quando o link muda."],
  ["publicar", "Opcional", "sim ou não. Vazio segue a opção escolhida abaixo."],
];

export default function PaginaImportar() {
  return (
    <>
      <h1 className="font-titulo text-3xl font-extrabold">Importar produtos por CSV</h1>
      <p className="mt-1 mb-6 max-w-[70ch] text-cinza">
        Monte a planilha no Excel ou no Google Planilhas, salve como CSV e envie aqui. Produto que já existe (mesmo link ou mesmo ID) é atualizado, não
        duplicado. Limite de {MAX_LINHAS_CSV} produtos por arquivo.
      </p>

      <FormularioImportacao />

      <section className="mt-10" aria-labelledby="t-colunas">
        <h2 id="t-colunas" className="mb-2 font-titulo text-lg font-bold">Colunas da planilha</h2>
        <p className="mb-3 text-sm">
          <a href="/modelo-importacao.csv" download className="font-semibold text-laranja-forte underline">Baixar planilha modelo (CSV)</a>
        </p>
        <div className="overflow-x-auto rounded-lg border border-linha bg-white">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-linha text-cinza">
              <tr><th className="p-3 font-semibold">Coluna</th><th className="p-3 font-semibold">Preenchimento</th><th className="p-3 font-semibold">O que colocar</th></tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {COLUNAS.map(([nome, tipo, texto]) => (
                <tr key={nome}><td className="p-3 font-mono">{nome}</td><td className="p-3">{tipo}</td><td className="p-3">{texto}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-[70ch] text-sm text-cinza">
          Não existe coluna de preço anterior. O desconto aparece sozinho quando você importar o mesmo produto de novo com um preço menor.
        </p>
      </section>
    </>
  );
}
