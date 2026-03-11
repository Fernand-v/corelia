import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { SocketSpanRunner } from "./types.js";

const tracer = trace.getTracer("corelia-api-realtime");

export const withSocketSpan: SocketSpanRunner = async (name, attributes, run) =>
  tracer.startActiveSpan(name, async (span) => {
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined) {
        span.setAttribute(key, value);
      }
    }

    try {
      return await run();
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message
      });
      throw error;
    } finally {
      span.end();
    }
  });
