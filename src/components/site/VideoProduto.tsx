"use client";

/* eslint-disable @next/next/no-img-element -- capas externas, sem otimizador pago */
import { useState } from "react";
import type { Video } from "@/lib/video";
import { IconeSaida } from "./Icones";

const ROTULO: Record<Video["tipo"], string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  arquivo: "vídeo",
  shopee: "Shopee Video",
};

function Play() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
    </svg>
  );
}

/**
 * O player de terceiros (YouTube, TikTok, Instagram) só é carregado depois do clique:
 * a página fica leve e esses serviços não recebem dados de quem não quis assistir.
 */
export function VideoProduto({ video, nome, imagem }: { video: Video; nome: string; imagem: string | null }) {
  const [tocando, setTocando] = useState(false);

  if (video.tipo === "shopee") {
    return (
      <a
        href={video.link}
        target="_blank"
        rel="nofollow noopener"
        className="vm-btn vm-pilula min-h-14 w-full justify-center border-tinta bg-white px-6 text-base font-extrabold text-tinta shadow-duro-p"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-neon text-tinta">
          <Play />
        </span>
        Ver o vídeo na Shopee Video
        <IconeSaida />
      </a>
    );
  }

  const proporcao = video.tipo !== "arquivo" && video.vertical ? "aspect-[9/16] max-w-[360px]" : "aspect-video";
  const capa = video.tipo === "arquivo" ? imagem : (video.capa ?? imagem);

  return (
    <figure className="m-0">
      <div className={`relative mx-auto w-full overflow-hidden rounded-[22px] border-[3px] border-tinta bg-tinta shadow-duro ${proporcao}`}>
        {tocando ? (
          video.tipo === "arquivo" ? (
            <video src={video.arquivo} controls autoPlay playsInline className="absolute inset-0 h-full w-full bg-black object-contain" />
          ) : (
            <iframe
              src={video.embed}
              title={`Vídeo: ${nome}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 h-full w-full border-0"
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => setTocando(true)}
            className="group absolute inset-0 flex cursor-pointer items-center justify-center border-0 bg-transparent p-0"
            aria-label={`Assistir ao vídeo de ${nome}`}
          >
            {capa && <img src={capa} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-70" />}
            <span className="relative flex size-20 items-center justify-center rounded-full border-[3px] border-tinta bg-neon pl-1 text-tinta shadow-duro-p transition-transform group-hover:scale-110">
              <Play />
            </span>
            <span className="absolute bottom-3 left-3 rounded-full border-2 border-tinta bg-white px-3 py-1 text-sm font-bold text-tinta">
              Assistir ao vídeo
            </span>
          </button>
        )}
      </div>
      {video.tipo !== "arquivo" && (
        <figcaption className="mt-2 text-xs text-cinza">
          {tocando
            ? `Vídeo do ${ROTULO[video.tipo]}.`
            : `Ao tocar, o vídeo é carregado do ${ROTULO[video.tipo]}, que tem a própria política de privacidade.`}{" "}
          <a href={video.link} target="_blank" rel="nofollow noopener" className="underline">
            Abrir no {ROTULO[video.tipo]}
          </a>
        </figcaption>
      )}
    </figure>
  );
}
