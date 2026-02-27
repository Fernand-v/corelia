import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { env } from "./lib/env.js";

let sdk: NodeSDK | null = null;

export const startTelemetry = async () => {
  if (!env.OTEL_ENABLED || !env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return;
  }

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
  sdk = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME,
    traceExporter: new OTLPTraceExporter({
      url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
    })
  });
  await sdk.start();
};

export const stopTelemetry = async () => {
  if (!sdk) {
    return;
  }
  await sdk.shutdown();
  sdk = null;
};
