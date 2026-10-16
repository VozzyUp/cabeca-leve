// Quem é do time: e-mails em ADMIN_EMAILS (separados por vírgula). Arquivo à parte porque o proxy também usa.
export const isSupportAdmin = (email: string | null | undefined) =>
  !!email && (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
