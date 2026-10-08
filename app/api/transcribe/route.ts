import { getStore } from "@/lib/data";
import { transcribe, transcriptionEnabled } from "@/lib/transcribe";

const MAX = 10 * 1024 * 1024;  // 10 MB, uns 10 minutos de fala
const TYPES = /^audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|aac)/;

// POST /api/transcribe: ditado no app (áudio gravado no navegador vira texto)
export async function POST(request: Request) {
  await getStore();  // exige sessão (o proxy já barra quem não entrou)
  if (!transcriptionEnabled()) return Response.json({ error: "Transcrição desligada" }, { status: 503 });
  const type = request.headers.get("content-type") ?? "";
  if (!TYPES.test(type)) return Response.json({ error: "Formato de áudio não aceito" }, { status: 415 });
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > MAX) return Response.json({ error: "Áudio longo demais" }, { status: 413 });
  const audio = await request.arrayBuffer();
  if (audio.byteLength === 0 || audio.byteLength > MAX) return Response.json({ error: "Áudio vazio ou longo demais" }, { status: 413 });
  try {
    return Response.json({ text: await transcribe(audio, type.split(";")[0]) });
  } catch {
    return Response.json({ error: "Não deu para transcrever agora" }, { status: 502 });
  }
}
