/* eslint-disable @next/next/no-img-element -- imagens externas sem otimizador pago */
export function ImagemProduto({ url, nome, prioridade }: { url: string | null; nome: string; prioridade?: boolean }) {
  if (!url) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-fundo text-sm text-cinza" role="img" aria-label={`${nome} (sem imagem)`}>
        Sem imagem
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={nome}
      width={600}
      height={600}
      loading={prioridade ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      className="aspect-square w-full bg-fundo object-contain"
    />
  );
}
