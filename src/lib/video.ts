/**
 * Vídeo do produto. Aceita só sites conhecidos, para não abrir o site a páginas
 * arbitrárias dentro de um iframe:
 * - YouTube (inclusive Shorts), TikTok e Instagram (Reels/posts): tocam dentro do site;
 * - Shopee Video: a Shopee não oferece player para outros sites, então vira um botão
 *   que abre o vídeo na Shopee;
 * - arquivo .mp4/.webm em endereço https: toca com o player do navegador.
 */
export type Video =
  | { tipo: "youtube" | "tiktok" | "instagram"; embed: string; vertical: boolean; capa: string | null; link: string }
  | { tipo: "drive"; embed: string; link: string }
  | { tipo: "arquivo"; arquivo: string; link: string }
  | { tipo: "shopee"; link: string }
  /** Link curto do TikTok (vm.tiktok.com, vt.tiktok.com, tiktok.com/t/…). Ao salvar, vira o link completo (ver video-servidor.ts). */
  | { tipo: "tiktok-curto"; link: string };

export const SITES_DE_VIDEO = "YouTube, TikTok, Instagram, Google Drive, Shopee Video ou um arquivo .mp4";

const ID_DRIVE = /^[\w-]{15,80}$/;

const ID_YOUTUBE = /^[\w-]{11}$/;

export function analisarVideo(valor: string | null | undefined): Video | null {
  if (!valor) return null;
  let url: URL;
  try {
    url = new URL(valor.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const partes = url.pathname.split("/").filter(Boolean);
  const link = url.toString();

  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    let id: string | null = null;
    let vertical = false;
    if (host === "youtu.be") id = partes[0] ?? null;
    else if (partes[0] === "watch") id = url.searchParams.get("v");
    else if (["shorts", "embed", "live"].includes(partes[0] ?? "")) {
      id = partes[1] ?? null;
      vertical = partes[0] === "shorts";
    }
    if (!id || !ID_YOUTUBE.test(id)) return null;
    return {
      tipo: "youtube",
      embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`,
      vertical,
      capa: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      link,
    };
  }

  if (host === "vm.tiktok.com" || host === "vt.tiktok.com" || (host === "tiktok.com" && partes[0] === "t")) {
    const codigo = host === "tiktok.com" ? partes[1] : partes[0];
    if (!codigo || !/^[\w-]{5,30}$/.test(codigo)) return null;
    return { tipo: "tiktok-curto", link };
  }

  if (host === "tiktok.com") {
    const i = partes.indexOf("video");
    const id = i >= 0 ? partes[i + 1] : undefined;
    if (!id || !/^\d{5,25}$/.test(id)) return null;
    return { tipo: "tiktok", embed: `https://www.tiktok.com/player/v1/${id}?autoplay=1&rel=0`, vertical: true, capa: null, link };
  }

  if (host === "instagram.com") {
    if (!["reel", "reels", "p", "tv"].includes(partes[0] ?? "")) return null;
    const codigo = partes[1];
    if (!codigo || !/^[\w-]{5,40}$/.test(codigo)) return null;
    return { tipo: "instagram", embed: `https://www.instagram.com/p/${codigo}/embed/`, vertical: true, capa: null, link };
  }

  if (host === "drive.google.com") {
    // /file/d/ID/view, /file/u/0/d/ID/view, /open?id=ID, /uc?id=ID
    let id: string | null = null;
    if (partes[0] === "file") {
      const i = partes.indexOf("d");
      id = i >= 0 ? (partes[i + 1] ?? null) : null;
    } else if (partes[0] === "open" || partes[0] === "uc") id = url.searchParams.get("id");
    if (!id || !ID_DRIVE.test(id)) return null;
    return { tipo: "drive", embed: `https://drive.google.com/file/d/${id}/preview`, link: `https://drive.google.com/file/d/${id}/view` };
  }

  if (host === "shopee.com.br" || host.endsWith(".shopee.com.br") || host === "shope.ee" || host === "shp.ee") {
    return { tipo: "shopee", link };
  }

  if (/\.(mp4|webm)$/i.test(url.pathname)) return { tipo: "arquivo", arquivo: link, link };

  return null;
}
