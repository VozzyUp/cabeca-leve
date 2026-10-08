"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Cliente do navegador: só LÊ (o RLS limita às linhas da pessoa). Usado pelo Realtime.
let client: ReturnType<typeof createBrowserClient<Database>> | null = null;
export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createBrowserClient<Database>(url, key);
  return client;
}
