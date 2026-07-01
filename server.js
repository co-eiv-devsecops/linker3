const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");


const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const db = new DatabaseSync("linker.db");
db.exec(`CREATE TABLE IF NOT EXISTS links (
  code TEXT PRIMARY KEY,
  url  TEXT NOT NULL,
  visits INTEGER DEFAULT 0
)`);

const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "Content-Type": type });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

const UI = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8");

const server = http.createServer((req, res) => {
  const { method, url } = req;

  if (url === "/" || url === "/index.html")
    return send(res, 200, UI, "text/html");

  if (url === "/api/shorten" && method === "POST") {
    let body = "";
    req.on("data", d => (body += d));
    req.on("end", () => {
      try {
        const { url: target } = JSON.parse(body);
        if (!target || !/^https?:\/\/.+/.test(target))
          return send(res, 400, { error: "URL inválida" });
        const code = crypto.randomBytes(4).toString("hex");
        db.prepare("INSERT INTO links (code, url) VALUES (?, ?)").run(code, target);
        send(res, 201, { short: `https://3.n-la-c.app/${code}` });
      } catch { send(res, 400, { error: "JSON inválido" }); }
    });
    return;
  }

  const code = url.slice(1);
  const row = db.prepare("SELECT url FROM links WHERE code = ?").get(code);
  if (row) {
    db.prepare("UPDATE links SET visits = visits + 1 WHERE code = ?").run(code);
    res.writeHead(302, { Location: row.url });
    return res.end();
  }

  send(res, 404, { error: "No encontrado" });
});

server.listen(PORT, () => console.log(`Linker corriendo en ${BASE_URL}`));
