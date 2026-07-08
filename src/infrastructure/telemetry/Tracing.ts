import { performance } from "node:perf_hooks";

export type SpanAttributeValue = string | number | boolean;

export interface SpanLike {
  setAttribute(name: string, value: SpanAttributeValue): SpanLike;
  end(): void;
}

export interface TracerLike {
  startActiveSpan<T>(
    name: string,
    fn: (span: SpanLike) => T | Promise<T>
  ): T | Promise<T>;
}

function isPromiseLike(value: unknown): boolean {
  return typeof (value as PromiseLike<unknown> | undefined)?.then === "function";
}

export function withSpan<T>(
  tracer: TracerLike,
  name: string,
  attributes: Record<string, SpanAttributeValue | undefined>,
  work: (span: SpanLike) => T
): T;
export function withSpan<T>(
  tracer: TracerLike,
  name: string,
  attributes: Record<string, SpanAttributeValue | undefined>,
  work: (span: SpanLike) => Promise<T>
): Promise<T>;
export function withSpan<T>(
  tracer: TracerLike,
  name: string,
  attributes: Record<string, SpanAttributeValue | undefined>,
  work: (span: SpanLike) => T | Promise<T>
): T | Promise<T> {
  return tracer.startActiveSpan(name, (span) => {
    const startedAt = performance.now();

    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined) {
        span.setAttribute(key, value);
      }
    }

    const closeSpan = () => {
      span.setAttribute("duration_ms", performance.now() - startedAt);
      span.end();
    };

    try {
      const result = work(span);
      if (isPromiseLike(result)) {
        return (result as Promise<T>).finally(closeSpan);
      }

      closeSpan();
      return result;
    } catch (error) {
      closeSpan();
      throw error;
    }
  });
}
