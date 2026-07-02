const crypto = require("crypto");
const { getLink, saveLink, incrementVisits } = require("./db");

const URL_REGEX = /^https?:\/\/.+/;
const ALIAS_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

function shortenLink(target, alias) {
  if (!target || !URL_REGEX.test(target))
    return { error: "URL inválida", status: 400 };

  const useAlias = alias != null && alias !== "";

  if (useAlias && !ALIAS_REGEX.test(alias))
    return { error: "Alias inválido: solo letras, números, - y _ (3-30 caracteres)", status: 400 };

  const code = useAlias ? alias : crypto.randomBytes(4).toString("hex");

  if (useAlias && getLink(code))
    return { error: "El alias ya está en uso", status: 409 };

  try {
    saveLink(code, target);
  } catch (e) {
    if (e.message?.includes("UNIQUE constraint"))
      return { error: "Código ya existe", status: 409 };
    throw e;
  }

  return { code, status: 201 };
}

function resolveLink(code) {
  const row = getLink(code);
  if (!row) return null;
  incrementVisits(code);
  return row.url;
}

module.exports = { shortenLink, resolveLink };
