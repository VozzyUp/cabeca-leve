// Servidor falso da UAZAPI e da Asaas para os testes de ponta a ponta.
// Guarda cada chamada; os testes leem em GET /__calls e limpam com DELETE /__calls.
import http from "node:http";

const calls = [];
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
    let body = null;
    try { body = data ? JSON.parse(data) : null; } catch { body = data; }
    calls.push({ method: req.method, url: req.url, headers: req.headers, body });
    if (req.url === "/v3/checkouts") return res.end(JSON.stringify({ id: `chk_e2e_${Date.now()}_${++n}` }));
    if (req.url.startsWith("/v3/subscriptions/")) return res.end(JSON.stringify({ deleted: true, id: req.url.split("/").pop() }));
    if (req.url === "/send/text") return res.end(JSON.stringify({ messageid: `out_${++n}` }));
    res.end("{}");
  });
}).listen(4010, "127.0.0.1", () => console.log("mock em http://127.0.0.1:4010"));
