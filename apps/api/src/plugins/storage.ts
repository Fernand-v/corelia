import fp from "fastify-plugin";
import { Client } from "minio";
import { env } from "../config/env.js";

export const storagePlugin = fp(async (app) => {
  const client = new Client({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: env.MINIO_USE_SSL,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY
  });

  const bucket = env.MINIO_BUCKET;

  const exists = await client.bucketExists(bucket).catch(() => false);
  if (!exists) {
    await client.makeBucket(bucket, "us-east-1");
  }

  app.decorate("storage", {
    bucket,
    putObject: async (objectKey: string, body: Buffer, mimeType: string) => {
      await client.putObject(bucket, objectKey, body, body.length, {
        "Content-Type": mimeType
      });
    },
    getObjectStream: async (objectKey: string) => {
      return client.getObject(bucket, objectKey);
    },
    removeObject: async (objectKey: string) => {
      await client.removeObject(bucket, objectKey);
    }
  });
});
