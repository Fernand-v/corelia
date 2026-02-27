import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startTelemetry, stopTelemetry } from "./telemetry.js";

const bootstrap = async () => {
  await startTelemetry();
  const app = await createApp();

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT
    });
  } catch (error) {
    app.log.error(error);
    await stopTelemetry();
    process.exit(1);
  }

  const shutdown = async () => {
    await app.close();
    await stopTelemetry();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
};

void bootstrap();
