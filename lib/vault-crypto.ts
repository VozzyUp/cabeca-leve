// Cofre de senhas: tudo é cifrado e decifrado no aparelho, com a Web Crypto do navegador.
// A chave sai da senha mestra (PBKDF2-SHA256, 600 mil rodadas, sal aleatório) e cifra cada item
// com AES-GCM (IV novo a cada gravação). O servidor só guarda sal, rodadas, um verificador e os
// itens cifrados: sem a senha mestra ninguém lê, nem o time, nem a IA. Esqueceu a senha, perdeu o cofre.

export const VAULT_ITERATIONS = 600_000;
const VERIFIER_TEXT = "cabeca-leve-cofre-v1";

export type VaultItem = { title: string; url: string; username: string; password: string; notes: string };
export type Sealed = { iv: string; ciphertext: string };

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
export const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export const newSalt = () => toB64(globalThis.crypto.getRandomValues(new Uint8Array(16)));

export async function deriveKey(password: string, salt: string, iterations = VAULT_ITERATIONS): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", enc.encode(password.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: fromB64(salt), iterations }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function seal(key: CryptoKey, text: string): Promise<Sealed> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const data = await subtle().encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  return { iv: toB64(iv), ciphertext: toB64(new Uint8Array(data)) };
}

// Senha errada ou dado adulterado: o AES-GCM recusa (devolve null, sem quebrar a tela)
export async function open(key: CryptoKey, sealed: Sealed): Promise<string | null> {
  try { return dec.decode(await subtle().decrypt({ name: "AES-GCM", iv: fromB64(sealed.iv) }, key, fromB64(sealed.ciphertext))); }
  catch { return null; }
}

export const sealItem = (key: CryptoKey, item: VaultItem) => seal(key, JSON.stringify(item));
export async function openItem(key: CryptoKey, sealed: Sealed): Promise<VaultItem | null> {
  const text = await open(key, sealed);
  if (!text) return null;
  try {
    const o = JSON.parse(text) as Partial<VaultItem>;
    return { title: o.title ?? "", url: o.url ?? "", username: o.username ?? "", password: o.password ?? "", notes: o.notes ?? "" };
  } catch { return null; }
}

export const makeVerifier = (key: CryptoKey) => seal(key, VERIFIER_TEXT);
export const checkVerifier = async (key: CryptoKey, v: Sealed) => (await open(key, v)) === VERIFIER_TEXT;

// Gerador de senha: 20 caracteres de um alfabeto sem os parecidos (0/O, 1/l/I), com sorteio sem viés
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_+=?";
export function generatePassword(length = 20): string {
  const out: string[] = [];
  const limit = 256 - (256 % ALPHABET.length);
  while (out.length < length) {
    for (const b of globalThis.crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < limit && out.length < length) out.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  return out.join("");
}

// Força aproximada, só para orientar (não é auditoria)
export function strength(password: string): "fraca" | "média" | "forte" {
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (password.length >= 14 && kinds >= 3) return "forte";
  if (password.length >= 10 && kinds >= 2) return "média";
  return "fraca";
}
