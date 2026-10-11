/* eslint-disable @next/next/no-img-element -- imagens externas sem otimizador pago */
import { IconeFoto } from "./site/Icones";

export function ImagemProduto({ url, nome, prioridade, compacto }: { url: string | null; nome: string; prioridade?: boolean; compacto?: boolean }) {
  if (!url) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 text-sm font-semibold text-cinza" role="img" aria-label={`${nome} (sem imagem)`}>
        <IconeFoto tamanho={compacto ? 24 : 34} />
        {!compacto && "Sem imagem"}
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
      className="aspect-square w-full bg-white object-contain"
    />
  );
}
