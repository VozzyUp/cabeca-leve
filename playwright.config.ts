import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

// chaves do Supabase local vêm do .env.local (nunca escritas no código)
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");

// Ponta a ponta contra o dev server com o Supabase local (npm run db:start) e um servidor
// falso para a UAZAPI e a Asaas (e2e/mock-server.mjs). Sem ANTHROPIC_API_KEY: a conversa usa
// o intérprete de regras, que é determinístico. O agente tem testes de integração próprios.
export const MOCK = "http://127.0.0.1:4010";
export const E2E_ENV = {
  UAZAPI_BASE_URL: MOCK,
  UAZAPI_INSTANCE_TOKEN: "token-e2e",
  UAZAPI_WEBHOOK_SECRET: "segredo-e2e",
  WHATSAPP_PROVIDER: "uazapi",
  WHATSAPP_BOT_NUMBER: "5511900000000",
  ASAAS_API_URL: `${MOCK}/v3`,
  ASAAS_API_KEY: "chave-e2e",
  ASAAS_WEBHOOK_TOKEN: "token-do-webhook-e2e-com-mais-de-32-caracteres",
  CRON_SECRET: "dev-cron-secret",
  RESEND_API_KEY: "chave-e2e",
  RESEND_API_URL: MOCK,
  EMAIL_FROM: "Cabeça Leve <oi@exemplo.com.br>",
  SUPPORT_EMAIL: "time@exemplo.com.br",
  SUPPORT_WHATSAPP: "5511988887777",
  ADMIN_EMAILS: "dono-e2e@exemplo.com.br,config-e2e@exemplo.com.br",  // o 2º é só do admin.spec: o F3 apaga e recria o 1º
  APP_SECRET_KEY: "chave-de-criptografia-dos-testes-e2e-com-mais-de-32",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  ANTHROPIC_API_KEY: "",
  LIMIT_DAILY_MESSAGES_TRIAL: "100000",  // os testes dividem contas e mandam muitas mensagens
  LIMIT_DAILY_MESSAGES_PAID: "100000",
  GROQ_API_KEY: "",
};

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },  // o dev server compila cada página na primeira visita
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "replica/e2e-results.json" }]],
  use: {
    baseURL: "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "celular", use: { ...devices["Pixel 7"] }, grep: /@celular/ },
  ],
  webServer: [
    { command: "node e2e/mock-server.mjs", url: `${MOCK}/__calls`, reuseExistingServer: true },
    { command: "npx next dev -p 3000", url: "http://localhost:3000/entrar", reuseExistingServer: true, timeout: 180_000, env: E2E_ENV },
  ],
});
