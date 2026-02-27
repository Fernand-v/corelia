import { context, propagation } from "@opentelemetry/api";

export const attachTraceContext = <T extends Record<string, unknown>>(payload: T) => {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);

  return {
    ...payload,
    _trace: carrier
  };
};
