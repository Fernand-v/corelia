import { context, propagation, trace } from "@opentelemetry/api";

export const runJobWithTrace = async <T>(
  jobName: string,
  payload: Record<string, unknown>,
  handler: () => Promise<T>
) => {
  const carrier =
    payload && typeof payload === "object"
      ? ((payload._trace as Record<string, string> | undefined) ?? {})
      : {};

  const parentContext = propagation.extract(context.active(), carrier);
  const tracer = trace.getTracer("corelia-workers");

  return context.with(parentContext, async () => {
    return tracer.startActiveSpan(jobName, async (span) => {
      try {
        return await handler();
      } catch (error) {
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    });
  });
};
