import { notificationWorker } from "./jobs/notification.worker.js";
import { webhookWorker } from "./jobs/webhook.worker.js";
import { automationWorker, startTaskLifecycleScheduler } from "./jobs/automation.worker.js";
import { startDocumentsPurgeScheduler } from "./jobs/documents-purge.worker.js";
import { startTelemetry, stopTelemetry } from "./telemetry.js";

const stopTaskLifecycleScheduler = startTaskLifecycleScheduler();
const stopDocumentsPurgeScheduler = startDocumentsPurgeScheduler();

const close = async () => {
  stopTaskLifecycleScheduler();
  stopDocumentsPurgeScheduler();
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
