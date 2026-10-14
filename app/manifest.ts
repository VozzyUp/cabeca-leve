import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// Manifesto do app instalável. No iPhone, só um app adicionado à Tela de Início com
// "display: standalone" recebe notificações (iOS 16.4 ou mais novo).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.description,
    lang: "pt-BR",
    start_url: "/conversa",
    scope: "/",
    display: "standalone",
    background_color: "#0f0e0d",
    theme_color: "#0f0e0d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
