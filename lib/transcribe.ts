// Transcrição de áudio pela Groq (Whisper, API compatível com a da OpenAI).
// Usada nos áudios do WhatsApp e no ditado. Sem GROQ_API_KEY, áudio fica desligado.
export const transcriptionEnabled = () => !!process.env.GROQ_API_KEY;

export async function transcribe(audio: ArrayBuffer, mimeType: string): Promise<string> {
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : mimeType.includes("wav") ? "wav" : "mp3";
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mimeType }), `audio.${ext}`);
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", "pt");
  form.append("response_format", "json");
  const res = await fetch(`${process.env.GROQ_API_URL ?? "https://api.groq.com/openai/v1"}/audio/transcriptions`, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: form,
  });
  if (!res.ok) throw new Error(`groq ${res.status} ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { text: string }).text.trim();
}
