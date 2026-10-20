import { iconeSvg, MARCA } from "@/lib/marca";

// Ícone do navegador, com as cores da marca (o ícone fixo antigo, src/app/icon.svg, foi removido).
export function GET() {
  return new Response(iconeSvg(MARCA.cores), {
    headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
