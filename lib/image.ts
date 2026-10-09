import sharp from "sharp";

// Foto que a pessoa manda (comprovante, fatura, plano de treino ou alimentar): vira um JPEG de até 1280 px,
// já girado pelo EXIF e sem os metadados (a localização da foto não vai para a IA nem para o banco).
// 1280 px de lado custam uns 1.600 tokens na IA e ainda dá para ler um comprovante.

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export type ChatImage = { mediaType: "image/jpeg"; data: string };

export class ImageError extends Error {}

const FORMATS = new Set(["jpeg", "png", "webp", "gif", "tiff", "avif"]);

export async function normalizeImage(input: ArrayBuffer | Buffer): Promise<ChatImage> {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (!buf.length) throw new ImageError("A foto veio vazia.");
  if (buf.length > MAX_IMAGE_BYTES) throw new ImageError("Foto grande demais (até 12 MB).");
  try {
    const image = sharp(buf, { limitInputPixels: 100_000_000, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.format || !FORMATS.has(meta.format)) throw new ImageError("Esse formato de imagem não é aceito. Mande JPEG, PNG ou WebP.");
    let quality = 82;
    let out = await image.rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }).jpeg({ quality, mozjpeg: true }).toBuffer();
    while (out.length > 1_200_000 && quality > 50) {
      quality -= 12;
      out = await sharp(out).jpeg({ quality, mozjpeg: true }).toBuffer();
    }
    return { mediaType: "image/jpeg", data: out.toString("base64") };
  } catch (error) {
    if (error instanceof ImageError) throw error;
    throw new ImageError("Não consegui abrir essa foto. Tente mandar de novo.");
  }
}
