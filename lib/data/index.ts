import { fakeStore } from "./fake-store";
import type { DataStore } from "./store";

// Único ponto de troca: o /replica-backend aponta isto para a implementação Supabase.
export function getStore(): DataStore {
  return fakeStore;
}
