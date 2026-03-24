import { Worker } from "bullmq";
import { createHmac, timingSafeEqual } from "crypto";
import { PrismaClient } from "@prisma/client";
import { connection } from "../lib/queues.js";
import { runJobWithTrace } from "../lib/tracing.js";

export function signWebhookPayload(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyWebhookSignature(secret: string, body: string, signature: string): boolean {
  const expected = signWebhookPayload(secret, body);
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

const prisma = new PrismaClient();

export const webhookWorker = new Worker(
  "webhooks",
  async (job) => {
    return runJobWithTrace(
      "worker.webhooks.deliver",
      (job.data as Record<string, unknown>) ?? {},
      async () => {
        const { endpointId, payload } = job.data as {
          endpointId: string;
          payload: Record<string, unknown>;
        };

        const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: endpointId } });
        if (!endpoint || !endpoint.enabled) {
          return;
        }

        let statusCode: number | null = null;
        let success = false;

        try {
          const body = JSON.stringify(payload);
          const signature = signWebhookPayload(endpoint.secret, body);
          const response = await fetch(endpoint.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-corelia-signature": signature
            },
            body
          });
          statusCode = response.status;
          success = response.ok;
        } catch {
          success = false;
        }

        await prisma.webhookDelivery.create({
          data: {
            endpointId,
            payload: payload as never,
            statusCode,
            success
          }
        });
      }
    );
  },
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 }
    }
  }
);
