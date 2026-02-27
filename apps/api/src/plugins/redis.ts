import fp from "fastify-plugin";
import { redis } from "../lib/redis.js";

export const redisPlugin = fp(async (app) => {
  app.decorate("redis", redis);

  app.addHook("onClose", async () => {
    await app.redis.quit();
  });
});
