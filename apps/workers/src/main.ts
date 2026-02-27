import { notificationWorker } from "./jobs/notification.worker.js";
import { webhookWorker } from "./jobs/webhook.worker.js";
import { automationWorker } from "./jobs/automation.worker.js";
import { startTelemetry, stopTelemetry } from "./telemetry.js";

const close = async () => {
  await Promise.all([
    notificationWorker.close(),
    webhookWorker.close(),
    automationWorker.close()
  ]);
  await stopTelemetry();
};

void startTelemetry();

process.on("SIGINT", () => {
  void close().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void close().finally(() => process.exit(0));
});
