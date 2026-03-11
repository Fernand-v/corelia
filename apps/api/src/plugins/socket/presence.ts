import type { FastifyInstance } from "fastify";

const PRESENCE_ONLINE_KEY_PREFIX = "presence:online:";

export const presenceKey = (userId: string) => `${PRESENCE_ONLINE_KEY_PREFIX}${userId}`;

export const markSocketOnline = (app: FastifyInstance, userId: string, socketId: string) => {
  const redisClient = (app as {
    redis?: {
      sadd?: (key: string, member: string) => Promise<unknown>;
      expire?: (key: string, seconds: number) => Promise<unknown>;
    };
  }).redis;

  if (redisClient?.sadd && redisClient?.expire) {
    void redisClient
      .sadd(presenceKey(userId), socketId)
      .then(() => redisClient.expire?.(presenceKey(userId), 60 * 60 * 24))
      .catch(() => undefined);
  }
};

export const markSocketOffline = (app: FastifyInstance, userId: string, socketId: string) => {
  const redisClient = (app as {
    redis?: {
      srem?: (key: string, member: string) => Promise<unknown>;
    };
  }).redis;

  if (redisClient?.srem) {
    void redisClient.srem(presenceKey(userId), socketId).catch(() => undefined);
  }
};
