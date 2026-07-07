import assert from "node:assert/strict";
import test from "node:test";
import { createLogger, parseLogLevel } from "../src/infrastructure/Logger.ts";

function captureConsole() {
  const calls: { stream: "log" | "warn" | "error"; args: unknown[] }[] = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  console.log = (...args: unknown[]) => calls.push({ stream: "log", args });
  console.warn = (...args: unknown[]) => calls.push({ stream: "warn", args });
  console.error = (...args: unknown[]) => calls.push({ stream: "error", args });
  return {
    calls,
    restore(): void {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    },
  };
}

test("parseLogLevel reconoce los niveles válidos", () => {
  assert.equal(parseLogLevel("debug"), "debug");
  assert.equal(parseLogLevel("info"), "info");
  assert.equal(parseLogLevel("warn"), "warn");
  assert.equal(parseLogLevel("error"), "error");
});

test("parseLogLevel cae a info con valores ausentes o inválidos", () => {
  assert.equal(parseLogLevel(undefined), "info");
  assert.equal(parseLogLevel("verbose"), "info");
  assert.equal(parseLogLevel(""), "info");
});

test("con minLevel=debug se emiten los 4 niveles", () => {
  const capture = captureConsole();
  try {
    const logger = createLogger("debug");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    assert.equal(capture.calls.length, 4);
  } finally {
    capture.restore();
  }
});

test("con minLevel=info se silencia debug pero no info/warn/error", () => {
  const capture = captureConsole();
  try {
    const logger = createLogger("info");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    assert.equal(capture.calls.length, 3);
    assert.ok(!capture.calls.some((c) => String(c.args[0]).includes("[DEBUG]")));
  } finally {
    capture.restore();
  }
});

test("con minLevel=warn se silencian debug e info", () => {
  const capture = captureConsole();
  try {
    const logger = createLogger("warn");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    assert.equal(capture.calls.length, 2);
    assert.deepEqual(
      capture.calls.map((c) => c.stream),
      ["warn", "error"]
    );
  } finally {
    capture.restore();
  }
});

test("con minLevel=error solo se emite error", () => {
  const capture = captureConsole();
  try {
    const logger = createLogger("error");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    assert.equal(capture.calls.length, 1);
    assert.equal(capture.calls[0]?.stream, "error");
  } finally {
    capture.restore();
  }
});
