// Servidor falso da UAZAPI, da Asaas e da Resend para os testes de ponta a ponta.
// Guarda cada chamada; os testes leem em GET /__calls e limpam com DELETE /__calls.
import http from "node:http";

const calls = [];
// PDF mínimo (só precisa começar com %PDF-); o teste compara os bytes do que o app guardou
const SAMPLE_PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
let n = 0;
http.createServer((req, res) => {
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", () => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/__calls") {
      if (req.method === "DELETE") calls.length = 0;
      return res.end(JSON.stringify(calls));
    }
    // arquivo para o app baixar (documento enviado pelo WhatsApp)
    if (req.url === "/files/nota-hotel.pdf") {
      res.setHeader("content-type", "application/pdf");
      return res.end(SAMPLE_PDF);
    }
    let body = null;
    try { body = data ? JSON.parse(data) : null; } catch { body = data; }
    calls.push({ method: req.method, url: req.url, headers: req.headers, body });
    // cobranças pela API (pagamento dentro do app)
    if (req.url === "/v3/customers") return res.end(JSON.stringify({ id: `cus_e2e_${++n}` }));
    if (/^\/v3\/customers\/[^/]+$/.test(req.url)) return res.end(JSON.stringify({ id: req.url.split("/").pop() }));
    if (req.url === "/v3/payments" || req.url === "/v3/subscriptions") {
      const card = body?.creditCard?.number;
      if (card === "4000000000000002") { res.statusCode = 400; return res.end(JSON.stringify({ errors: [{ code: "invalid_creditCard", description: "Transação não autorizada. Verifique os dados do cartão ou use outro cartão." }] })); }
      if (body?.value === 6.66) { res.statusCode = 400; return res.end(JSON.stringify({ errors: [{ code: "invalid_object", description: "Cobrança recusada no teste" }] })); }
      if (req.url === "/v3/subscriptions") return res.end(JSON.stringify({ id: `sub_e2e_${Date.now()}_${++n}`, status: "ACTIVE" }));
      const method = body?.billingType;
      return res.end(JSON.stringify({ id: `pay_e2e_${Date.now()}_${++n}`, status: method === "CREDIT_CARD" ? "CONFIRMED" : "PENDING", bankSlipUrl: method === "BOLETO" ? "https://example.com/boleto.pdf" : undefined }));
    }
    if (/^\/v3\/payments\/[^/]+\/pixQrCode$/.test(req.url)) return res.end(JSON.stringify({ encodedImage: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", payload: "00020126580014br.gov.bcb.pix0136e2e-chave-pix-de-teste5204000053039865802BR5904Pera6009SAO PAULO62070503***6304ABCD", expirationDate: "2026-12-31 23:59:59" }));
    if (/^\/v3\/payments\/[^/]+\/identificationField$/.test(req.url)) return res.end(JSON.stringify({ identificationField: "23793.38128 60000.000003 00000.000400 1 84340000002990" }));
    // preço de R$ 6,66 também recusa o checkout hospedado (legado)
    if (req.url === "/v3/checkouts" && body?.items?.[0]?.value === 6.66) { res.statusCode = 400; return res.end(JSON.stringify({ errors: [{ code: "invalid_object", description: "Checkout recusado no teste" }] })); }
    if (req.url === "/v3/checkouts") return res.end(JSON.stringify({ id: `chk_e2e_${Date.now()}_${++n}` }));
    if (req.url.startsWith("/v3/subscriptions/")) return res.end(JSON.stringify({ deleted: true, id: req.url.split("/").pop() }));
    if (req.url === "/send/text" || req.url === "/send/menu" || req.url === "/send/media") return res.end(JSON.stringify({ messageid: `out_${++n}` }));
    if (req.url === "/message/download") return res.end(JSON.stringify({ fileURL: "http://127.0.0.1:4010/files/nota-hotel.pdf", mimetype: "application/pdf" }));
    if (/^\/v3\/payments\/[^/]+\/refund$/.test(req.url)) return res.end(JSON.stringify({ status: "REFUNDED" }));
    if (req.url === "/instance/status") return res.end(JSON.stringify({ instance: { status: "connected", owner: "5511900000000" }, status: { connected: true, loggedIn: true } }));
    if (req.url === "/webhook" && req.method === "GET") return res.end(JSON.stringify([{ id: "h1", enabled: true, url: "http://localhost:3000/api/webhooks/whatsapp?secret=segredo-e2e", events: ["messages"] }]));
    if (req.url === "/emails") return res.end(JSON.stringify({ id: `email_${++n}` }));
    res.end("{}");
  });
}).listen(4010, "127.0.0.1", () => console.log("mock em http://127.0.0.1:4010"));
