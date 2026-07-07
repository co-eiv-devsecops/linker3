import assert from "node:assert/strict";
import test from "node:test";
import type { Meter as OTelApiMeter } from "@opentelemetry/api";
import { OtelMeterAdapter } from "../src/infrastructure/telemetry/OtelMeter.ts";

/**
 * Builds a mock OpenTelemetry meter that records how each factory method
 * was called and returns spy instruments capturing their recordings.
 */
function makeMockOtelMeter() {
  const created: { kind: string; name: string; options?: unknown }[] = [];
  const recorded: { name: string; value: number; attrs?: unknown }[] = [];

  const instrument = (kind: "add" | "record", name: string) =>
    ({
      [kind]: (value: number, attrs?: unknown) => {
        recorded.push({ name, value, attrs });
      },
      // biome-ignore lint/suspicious/noExplicitAny: minimal test double
    }) as any;

  const meter = {
    createCounter: (name: string, options?: unknown) => {
      created.push({ kind: "counter", name, options });
      return instrument("add", name);
    },
    createHistogram: (name: string, options?: unknown) => {
      created.push({ kind: "histogram", name, options });
      return instrument("record", name);
    },
    createGauge: (name: string, options?: unknown) => {
      created.push({ kind: "gauge", name, options });
      return instrument("record", name);
    },
    // biome-ignore lint/suspicious/noExplicitAny: partial meter test double
  } as any as OTelApiMeter;

  return { meter, created, recorded };
}

test("OtelMeterAdapter delega la creación de cada tipo de instrumento", () => {
  const { meter, created } = makeMockOtelMeter();
  const adapter = new OtelMeterAdapter(meter);

  adapter.createCounter("links_created_total", { unit: "1" });
  adapter.createHistogram("shorten_duration_ms", { unit: "ms" });
  adapter.createGauge("active_links", { unit: "1" });

  assert.deepEqual(
    created.map((c) => c.kind),
    ["counter", "histogram", "gauge"]
  );
  assert.equal(created[0]?.name, "links_created_total");
  assert.deepEqual(created[1]?.options, { unit: "ms" });
});

test("los instrumentos del adapter reenvían valores al meter de OTel", () => {
  const { meter, recorded } = makeMockOtelMeter();
  const adapter = new OtelMeterAdapter(meter);

  adapter.createCounter("c").add(3, { route: "shorten" });
  adapter.createHistogram("h").record(42);
  adapter.createGauge("m").record(7);

  assert.deepEqual(recorded, [
    { name: "c", value: 3, attrs: { route: "shorten" } },
    { name: "h", value: 42, attrs: undefined },
    { name: "m", value: 7, attrs: undefined },
  ]);
});
