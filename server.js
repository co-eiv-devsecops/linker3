const http = require("http");
const fs = require("fs");
const path = require("path");
const { shortenLink, resolveLink } = require("./src/links");
const { getAllLinks } = require("./src/db");

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "Content-Type": type });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

const UI = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8");

const server = http.createServer((req, res) => {
  const { method, url } = req;

  if (url === "/" || url === "/index.html")
    return send(res, 200, UI, "text/html");

  if (url === "/api/links" && method === "GET")
    return send(res, 200, getAllLinks());

  if (url === "/api/shorten" && method === "POST") {
    let body = "";
    req.on("data", d => (body += d));
    req.on("end", () => {
      try {
        const { url: target, alias } = JSON.parse(body);
        const result = shortenLink(target, alias);
        if (result.error)
          return send(res, result.status, { error: result.error });
        send(res, result.status, { short: `${BASE_URL}/${result.code}` });
      } catch { send(res, 400, { error: "JSON inválido" }); }
    });
    return;
  }

  const code = url.slice(1);
  const target = resolveLink(code);
  if (target) {
    res.writeHead(302, { Location: target });
    return res.end();
  }

  send(res, 404, { error: "No encontrado" });
});

server.listen(PORT, () => console.log(`Linker corriendo en ${BASE_URL}`));
