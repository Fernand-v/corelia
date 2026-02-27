import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./env.js";

export const connection = new Redis(env.REDIS_URL, {
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: true
});

export const notificationsQueue = new Queue("notifications", { connection });
export const webhooksQueue = new Queue("webhooks", { connection });
export const automationsQueue = new Queue("automations", { connection });
