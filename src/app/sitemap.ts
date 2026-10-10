import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { slugsParaSitemap } from "@/lib/dados";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { produtos, categorias } = await slugsParaSitemap();
  const fixas = ["", "/ofertas", "/promocoes", "/categorias", "/afiliados", "/privacidade", "/termos", "/contato"];
  return [
    ...fixas.map((p) => ({ url: SITE_URL + p })),
    ...categorias.map((s) => ({ url: `${SITE_URL}/categorias/${s}` })),
    ...produtos.map((p) => ({ url: `${SITE_URL}/produto/${p.slug}`, lastModified: p.atualizado_em })),
  ];
}
