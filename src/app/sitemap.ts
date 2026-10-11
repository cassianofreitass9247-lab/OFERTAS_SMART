import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { slugsParaSitemap } from "@/lib/dados";

// Dados ao vivo: a página é montada a cada acesso (não é gerada no build).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { produtos, categorias } = await slugsParaSitemap();
  const fixas = ["", "/ofertas", "/promocoes", "/destaques", "/categorias", "/afiliados", "/privacidade", "/termos", "/contato"];
  return [
    ...fixas.map((p) => ({ url: SITE_URL + p })),
    ...categorias.map((s) => ({ url: `${SITE_URL}/categorias/${s}` })),
    ...produtos.map((p) => ({ url: `${SITE_URL}/produto/${p.slug}`, lastModified: p.atualizado_em })),
  ];
}
