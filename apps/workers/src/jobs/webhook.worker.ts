import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { connection } from "../lib/queues.js";
import { runJobWithTrace } from "../lib/tracing.js";

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
          const response = await fetch(endpoint.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-corelia-signature": endpoint.secret
            },
            body: JSON.stringify(payload)
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
    connection
  }
);
