import { getStore } from "@/lib/data";

export async function GET() {
  return Response.json({ messages: await getStore().listMessages() });
}
