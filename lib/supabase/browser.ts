"use client";
import { createBrowserClient } from "@supabase/ssr";
import { clientPublicEnv } from "@/lib/public-env";
import type { Database } from "./database.types";

// Cliente do navegador: só LÊ (o RLS limita às linhas da pessoa). Usado pelo Realtime.
let client: ReturnType<typeof createBrowserClient<Database>> | null = null;
export function browserClient() {
  const { supabaseUrl: url, supabaseKey: key } = clientPublicEnv();
  if (!url || !key) return null;
  client ??= createBrowserClient<Database>(url, key);
  return client;
}
