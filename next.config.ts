import type { NextConfig } from "next";

// Cabeçalhos de segurança em todas as respostas
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // imagem Docker enxuta: só o servidor e o que ele usa (Dockerfile)
  output: "standalone",
  // o proxy.ts passa por todas as rotas e corta o corpo do pedido em 10 MB: foto e áudio vão até 12 MB
  experimental: { proxyClientMaxBodySize: "13mb" },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
