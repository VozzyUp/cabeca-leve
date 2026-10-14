import { describe, expect, it } from "vitest";
import { vapidSubject } from "./push";

describe("assunto das notificações (VAPID)", () => {
  it("aceita mailto ou https e completa o e-mail sozinho", () => {
    expect(vapidSubject({ VAPID_SUBJECT: "mailto:oi@acme.com" }, "")).toBe("mailto:oi@acme.com");
    expect(vapidSubject({ VAPID_SUBJECT: "oi@acme.com" }, "")).toBe("mailto:oi@acme.com");
    expect(vapidSubject({ VAPID_SUBJECT: "https://acme.com" }, "")).toBe("https://acme.com");
  });
  it("sem configuração usa o e-mail do suporte ou o site (a Apple recusa endereço de exemplo)", () => {
    expect(vapidSubject({ SUPPORT_EMAIL: "time@acme.com" }, "https://app.acme.com")).toBe("mailto:time@acme.com");
    expect(vapidSubject({}, "https://app.acme.com")).toBe("https://app.acme.com");
  });
});
