import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { NOME_SITE, SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${NOME_SITE} — ofertas da Shopee com histórico de preço`, template: `%s | ${NOME_SITE}` },
  description: "Ofertas da Shopee organizadas por categoria. O desconto exibido é sempre calculado a partir de preços que o próprio site registrou.",
  openGraph: { siteName: NOME_SITE, locale: "pt_BR", type: "website" },
};

export const viewport: Viewport = { themeColor: "#f25c05" };

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
