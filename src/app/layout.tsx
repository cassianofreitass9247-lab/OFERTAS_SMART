import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "./globals.css";
import { NOME_SITE, SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${NOME_SITE}: achadinhos da Shopee garimpados pela Moni`, template: `%s | ${NOME_SITE}` },
  description:
    "Achadinhos da Shopee de beleza, casa, mundo infantil e muito mais, garimpados pela Moni. O desconto só aparece quando o preço cai de verdade.",
  openGraph: { siteName: NOME_SITE, locale: "pt_BR", type: "website", images: ["/moni.jpg"] },
};

export const viewport: Viewport = { themeColor: "#ff5b14" };

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
