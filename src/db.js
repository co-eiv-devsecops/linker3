const { DatabaseSync } = require("node:sqlite");

const db = new DatabaseSync(process.env.DB_PATH || "linker.db");

db.exec(`CREATE TABLE IF NOT EXISTS links (
  code    TEXT PRIMARY KEY,
  url     TEXT NOT NULL,
  visits  INTEGER DEFAULT 0
)`);

const getLink = (code) =>
  db.prepare("SELECT url FROM links WHERE code = ?").get(code);

const saveLink = (code, url) =>
  db.prepare("INSERT INTO links (code, url) VALUES (?, ?)").run(code, url);

const incrementVisits = (code) =>
  db.prepare("UPDATE links SET visits = visits + 1 WHERE code = ?").run(code);

const getAllLinks = () =>
  db.prepare("SELECT code, url, visits FROM links ORDER BY rowid DESC").all();

module.exports = { getLink, saveLink, incrementVisits, getAllLinks };
