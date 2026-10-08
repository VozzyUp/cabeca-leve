// E-mail transacional pela Resend (https://resend.com/docs/api-reference/emails/send-email):
// comprovante de cancelamento, chamados de suporte e respostas. Os e-mails de login saem do
// Supabase Auth (SMTP da Resend configurado no painel), não daqui.
// Sem RESEND_API_KEY e EMAIL_FROM não manda nada: o aviso dentro do app continua valendo.
export const emailEnabled = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!emailEnabled() || !to) return false;
  const base = (process.env.RESEND_API_URL ?? "https://api.resend.com").replace(/\/$/, "");
  const res = await fetch(`${base}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
  });
  if (!res.ok) console.error("email", res.status);  // só o código: nada do conteúdo no log
  return res.ok;
}
