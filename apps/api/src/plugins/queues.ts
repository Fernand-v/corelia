import { Queue } from "bullmq";
import fp from "fastify-plugin";

export const queuesPlugin = fp(async (app) => {
  const notifications = new Queue("notifications", { connection: app.redis });
  const webhooks = new Queue("webhooks", { connection: app.redis });
  const automations = new Queue("automations", { connection: app.redis });

  app.decorate("queues", {
    notifications,
    webhooks,
    automations
  });

  app.addHook("onClose", async () => {
    await Promise.all([notifications.close(), webhooks.close(), automations.close()]);
  });
});
