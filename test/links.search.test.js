const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const linksModulePath = path.resolve(__dirname, "../src/links.js");
const dbModulePath = path.resolve(__dirname, "../src/db.js");

function loadLinksWithDbMock(dbMock) {
  delete require.cache[linksModulePath];
  delete require.cache[dbModulePath];

  require.cache[dbModulePath] = {
    id: dbModulePath,
    filename: dbModulePath,
    loaded: true,
    exports: dbMock,
  };

  return require(linksModulePath);
}

test("resolveLink returns URL and increments visits when a record exists", () => {
  const calls = [];
  const { resolveLink } = loadLinksWithDbMock({
    getLink: (code) => {
      calls.push({ fn: "getLink", code });
      return { url: "https://example.com" };
    },
    saveLink: () => {
      throw new Error("saveLink should not be used in search tests");
    },
    incrementVisits: (code) => {
      calls.push({ fn: "incrementVisits", code });
    },
  });

  const result = resolveLink("abc123");

  assert.equal(result, "https://example.com");
  assert.deepEqual(calls, [
    { fn: "getLink", code: "abc123" },
    { fn: "incrementVisits", code: "abc123" },
  ]);
});

test("resolveLink returns null and does not increment visits when no record is found", () => {
  let incrementCalled = false;
  const { resolveLink } = loadLinksWithDbMock({
    getLink: () => null,
    saveLink: () => {
      throw new Error("saveLink should not be used in search tests");
    },
    incrementVisits: () => {
      incrementCalled = true;
    },
  });

  const result = resolveLink("missing");

  assert.equal(result, null);
  assert.equal(incrementCalled, false);
});

test("resolveLink handles invalid and edge-case inputs as not found", () => {
  const seenCodes = [];
  const { resolveLink } = loadLinksWithDbMock({
    getLink: (code) => {
      seenCodes.push(code);
      return null;
    },
    saveLink: () => {
      throw new Error("saveLink should not be used in search tests");
    },
    incrementVisits: () => {
      throw new Error("incrementVisits should not run when search has no result");
    },
  });

  assert.equal(resolveLink(""), null);
  assert.equal(resolveLink("   "), null);
  assert.equal(resolveLink(undefined), null);
  assert.deepEqual(seenCodes, ["", "   ", undefined]);
});

test("resolveLink propagates database errors from search dependency", () => {
  const { resolveLink } = loadLinksWithDbMock({
    getLink: () => {
      throw new Error("db unavailable");
    },
    saveLink: () => {
      throw new Error("saveLink should not be used in search tests");
    },
    incrementVisits: () => {
      throw new Error("incrementVisits should not run when getLink fails");
    },
  });

  assert.throws(() => resolveLink("abc"), /db unavailable/);
});
