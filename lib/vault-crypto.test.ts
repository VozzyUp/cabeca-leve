// @vitest-environment node
import { describe, expect, it } from "vitest";
import { checkVerifier, deriveKey, generatePassword, makeVerifier, newSalt, openItem, sealItem, strength } from "./vault-crypto";

// rodadas baixas só no teste, para ser rápido; o app usa 600 mil
const FAST = 1000;
const item = { title: "Banco", url: "https://banco.com.br", username: "fernando", password: "s3nha-Forte!", notes: "conta conjunta" };

describe("cofre de senhas", () => {
  it("cifra e abre com a mesma senha; o texto cifrado não mostra nada", async () => {
    const salt = newSalt();
    const key = await deriveKey("minha senha mestra", salt, FAST);
    const sealed = await sealItem(key, item);
    expect(sealed.ciphertext).not.toContain("fernando");
    expect(atob(sealed.ciphertext)).not.toContain("s3nha");
    expect(await openItem(key, sealed)).toEqual(item);
    // IV novo a cada gravação: o mesmo item cifrado duas vezes dá textos diferentes
    expect((await sealItem(key, item)).ciphertext).not.toBe(sealed.ciphertext);
  });

  it("senha mestra errada não abre e o verificador diz que está errada", async () => {
    const salt = newSalt();
    const right = await deriveKey("certa", salt, FAST);
    const wrong = await deriveKey("errada", salt, FAST);
    const v = await makeVerifier(right);
    expect(await checkVerifier(right, v)).toBe(true);
    expect(await checkVerifier(wrong, v)).toBe(false);
    expect(await openItem(wrong, await sealItem(right, item))).toBeNull();
  });

  it("dado adulterado é recusado", async () => {
    const key = await deriveKey("x", newSalt(), FAST);
    const sealed = await sealItem(key, item);
    const bytes = Uint8Array.from(atob(sealed.ciphertext), (c) => c.charCodeAt(0));
    bytes[0] ^= 1;
    expect(await openItem(key, { iv: sealed.iv, ciphertext: btoa(String.fromCharCode(...bytes)) })).toBeNull();
  });

  it("gera senhas fortes e diferentes; avalia a força", () => {
    const a = generatePassword(), b = generatePassword();
    expect(a).toHaveLength(20);
    expect(a).not.toBe(b);
    expect(a).not.toMatch(/[0O1lI]/);
    expect(strength("abc")).toBe("fraca");
    expect(strength("abcdef1234")).toBe("média");
    expect(strength("Xk9#mP2$vL7!qR4z")).toBe("forte");
  });
});
