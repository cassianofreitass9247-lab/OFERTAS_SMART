import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "./globals.css";
import { NOME_SITE, SITE_URL } from "@/lib/config";
import { F, MARCA, variaveisDeCor } from "@/lib/marca";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${NOME_SITE}: achadinhos da Shopee garimpados ${F.pela}`, template: `%s | ${NOME_SITE}` },
  description: MARCA.descricaoSite,
  icons: { icon: "/icone.svg" },
  openGraph: { siteName: NOME_SITE, locale: "pt_BR", type: "website", images: [MARCA.foto] },
};

export const viewport: Viewport = { themeColor: MARCA.cores.principal };

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" style={variaveisDeCor(MARCA.cores) as React.CSSProperties}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
