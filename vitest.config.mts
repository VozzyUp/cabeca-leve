import tsconfigPaths from "vite-tsconfig-paths";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  // .env.local (Supabase local) entra no process.env dos testes de integração; nada de chave no código
  test: { include: ["lib/**/*.test.ts", "components/**/*.test.ts"], environment: "node", env: loadEnv("test", process.cwd(), "") },
});
