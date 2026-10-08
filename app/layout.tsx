import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: BRAND.color };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        {/* valores públicos do ambiente; o Next põe no <head>, antes de qualquer script do app (lib/public-env.ts) */}
        <Script src="/env.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
