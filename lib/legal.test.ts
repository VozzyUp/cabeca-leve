import { describe, expect, it } from "vitest";
import { operator, privacySections, termsSections } from "./legal";

describe("textos legais", () => {
  it("usa os dados da empresa quando existem e cai no nome do app quando não", () => {
    expect(operator({})).toEqual({ name: "Cabeça Leve", document: null, email: null });
    expect(operator({ LEGAL_COMPANY_NAME: "Acme Ltda", LEGAL_COMPANY_DOCUMENT: "00.000.000/0001-00", SUPPORT_EMAIL: "oi@acme.com" }))
      .toEqual({ name: "Acme Ltda", document: "00.000.000/0001-00", email: "oi@acme.com" });
    expect(operator({ LEGAL_CONTACT_EMAIL: "dpo@acme.com", SUPPORT_EMAIL: "oi@acme.com" }).email).toBe("dpo@acme.com");
  });
  it("a política cita os fornecedores e os direitos da LGPD; os termos citam cancelamento e arrependimento", () => {
    const text = (s: ReturnType<typeof privacySections>) => JSON.stringify(s);
    const p = text(privacySections(operator({})));
    for (const x of ["Anthropic", "Supabase", "Groq", "Asaas", "Resend", "LGPD", "ANPD", "2 dias"]) expect(p).toContain(x);
    const t = text(termsSections(operator({ SUPPORT_EMAIL: "oi@acme.com" })));
    for (const x of ["7 dias", "cancelar", "oi@acme.com", "A IA pode errar"]) expect(t).toContain(x);
  });
});
