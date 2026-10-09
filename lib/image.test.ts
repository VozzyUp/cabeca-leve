import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ImageError, normalizeImage } from "./image";

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }).png().toBuffer();

describe("foto do chat", () => {
  it("vira JPEG de no máximo 1280 px, mantendo a proporção", async () => {
    const out = await normalizeImage(await solid(3000, 2000));
    expect(out.mediaType).toBe("image/jpeg");
    const meta = await sharp(Buffer.from(out.data, "base64")).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1280);
    expect(meta.height).toBe(853);
  });

  it("foto pequena não é ampliada; PNG com transparência ganha fundo branco", async () => {
    const png = await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const out = await normalizeImage(png);
    const img = sharp(Buffer.from(out.data, "base64"));
    expect((await img.metadata()).width).toBe(200);
    const { data } = await img.raw().toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 3)].every((v) => v > 240)).toBe(true);  // branco, não preto
  });

  it("gira pela orientação do EXIF e tira os metadados", async () => {
    const tall = await sharp({ create: { width: 400, height: 200, channels: 3, background: "#336699" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const out = await normalizeImage(tall);
    const meta = await sharp(Buffer.from(out.data, "base64")).metadata();
    expect([meta.width, meta.height]).toEqual([200, 400]);  // orientação 6 = girar 90°
    expect(meta.exif).toBeUndefined();
  });

  it("recusa vazio, grande demais e o que não é imagem, com mensagem para a pessoa", async () => {
    await expect(normalizeImage(Buffer.alloc(0))).rejects.toThrow(ImageError);
    await expect(normalizeImage(Buffer.alloc(13 * 1024 * 1024, 1))).rejects.toThrow(/até 12 MB/);
    await expect(normalizeImage(Buffer.from("isto não é uma imagem"))).rejects.toThrow(/Não consegui abrir/);
    await expect(normalizeImage(await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).tiff().toBuffer())).resolves.toBeTruthy();
  });
});
