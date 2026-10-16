import { describe, expect, it } from "vitest";
import { isCep, isCpfCnpj, isCvv, isPhone, luhnOk, maskCard, maskCpfCnpj, maskExpiry, maskPhone, parseExpiry } from "./br-docs";

describe("documentos e cartão", () => {
  it("CPF e CNPJ conferem o dígito verificador", () => {
    expect(isCpfCnpj("529.982.247-25")).toBe(true);
    expect(isCpfCnpj("52998224725")).toBe(true);
    expect(isCpfCnpj("529.982.247-24")).toBe(false);
    expect(isCpfCnpj("111.111.111-11")).toBe(false);
    expect(isCpfCnpj("11.222.333/0001-81")).toBe(true);
    expect(isCpfCnpj("11.222.333/0001-80")).toBe(false);
    expect(isCpfCnpj("")).toBe(false);
  });
  it("CEP e telefone", () => {
    expect(isCep("01310-100")).toBe(true);
    expect(isCep("0131010")).toBe(false);
    expect(isPhone("(11) 91234-5678")).toBe(true);
    expect(isPhone("+55 11 91234-5678")).toBe(true);
    expect(isPhone("(11) 3456-7890")).toBe(true);
    expect(isPhone("12345")).toBe(false);
    expect(isPhone("(00) 91234-5678")).toBe(false);
  });
  it("cartão: Luhn, validade e CVV", () => {
    expect(luhnOk("4111 1111 1111 1111")).toBe(true);
    expect(luhnOk("4111 1111 1111 1112")).toBe(false);
    expect(luhnOk("1234")).toBe(false);
    const now = new Date("2026-10-16T12:00:00Z");
    expect(parseExpiry("12/28", now)).toEqual({ month: "12", year: "2028" });
    expect(parseExpiry("10/2026", now)).toEqual({ month: "10", year: "2026" });
    expect(parseExpiry("09/26", now)).toBeNull();
    expect(parseExpiry("13/28", now)).toBeNull();
    expect(parseExpiry("abc", now)).toBeNull();
    expect(isCvv("123")).toBe(true);
    expect(isCvv("12")).toBe(false);
  });
  it("máscaras", () => {
    expect(maskCpfCnpj("52998224725")).toBe("529.982.247-25");
    expect(maskCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(maskPhone("11912345678")).toBe("(11) 91234-5678");
    expect(maskPhone("1134567890")).toBe("(11) 3456-7890");
    expect(maskCard("4111111111111111")).toBe("4111 1111 1111 1111");
    expect(maskExpiry("1228")).toBe("12/28");
  });
});
