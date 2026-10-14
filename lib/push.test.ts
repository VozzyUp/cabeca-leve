import { describe, expect, it } from "vitest";
import { vapidSubject } from "./push";
import { urlSafeKey } from "./public-env";

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
  it("chave VAPID colada com \"=\", \"+\" ou \"/\" vira o formato de URL que o envio exige", () => {
    expect(urlSafeKey(" BAbc+def/ghi== ")).toBe("BAbc-def_ghi");
    expect(urlSafeKey("BAbc-def_ghi")).toBe("BAbc-def_ghi");
    expect(urlSafeKey("")).toBeNull();
  });
});
