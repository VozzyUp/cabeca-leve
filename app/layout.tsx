import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { StandaloneGuard } from "@/components/standalone-guard";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  // no iPhone, abre como app (sem a barra do Safari) quando adicionado à Tela de Início
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "black" },
  formatDetection: { telephone: false },  // o iPhone não transforma números em links e muda o layout
};

// Tela fixa como a de um app: sem zoom (nem de pinça, nem o que o iPhone dá ao tocar num campo) e o teclado encolhe a
// página (resizes-content) em vez de empurrá-la. Decisão do dono: parecer app vale mais que o zoom do navegador.
export const viewport: Viewport = {
  themeColor: BRAND.color, width: "device-width", initialScale: 1, minimumScale: 1, maximumScale: 1, userScalable: false,
  viewportFit: "cover", interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <StandaloneGuard />
        {/* valores públicos do ambiente; o Next põe no <head>, antes de qualquer script do app (lib/public-env.ts) */}
        <Script src="/env.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
