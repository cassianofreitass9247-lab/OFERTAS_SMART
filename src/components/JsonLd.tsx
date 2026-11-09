// Dados estruturados (schema.org) em JSON-LD. O "<" é escapado para o conteúdo nunca fechar a tag <script>.
export function JsonLd({ dados }: { dados: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(dados).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
