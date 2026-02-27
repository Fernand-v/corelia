import fp from "fastify-plugin";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { env } from "../config/env.js";

const tracer = trace.getTracer("corelia-api-media");

export const mediaPlugin = fp(async (app) => {
  const state: {
    enabled: boolean;
    healthy: boolean;
    detail: string | null;
    driver: "mediasoup" | "disabled";
    worker: unknown | null;
    rooms: Map<string, unknown>;
  } = {
    enabled: env.MEDIA_SERVER_ENABLED,
    healthy: false,
    detail: null,
    driver: env.MEDIA_SERVER_ENABLED ? "mediasoup" : "disabled",
    worker: null,
    rooms: new Map()
  };

  app.decorate("media", {
    getHealth: () => ({
      enabled: state.enabled,
      healthy: state.healthy,
      detail: state.detail,
      driver: state.driver
    }),
    getRoomCapabilities: async (roomId: string) =>
      tracer.startActiveSpan("media.room.capabilities", async (span) => {
        span.setAttribute("corelia.media.room_id", roomId);

        try {
          if (!state.enabled) {
            return {
              available: false,
              rtpCapabilities: null
            };
          }

          if (!state.worker) {
            throw new Error(state.detail ?? "Servidor de medios no disponible");
          }

          const existing = state.rooms.get(roomId);
          if (existing) {
            const router = existing as { rtpCapabilities: unknown };
            return {
              available: true,
              rtpCapabilities: router.rtpCapabilities
            };
          }

          const worker = state.worker as {
            createRouter: (input: { mediaCodecs: Array<Record<string, unknown>> }) => Promise<{
              rtpCapabilities: unknown;
              close: () => void;
            }>;
          };

          const router = await worker.createRouter({
            mediaCodecs: [
              {
                kind: "audio",
                mimeType: "audio/opus",
                clockRate: 48000,
                channels: 2
              },
              {
                kind: "video",
                mimeType: "video/VP8",
                clockRate: 90000
              }
            ]
          });

          state.rooms.set(roomId, router);
          return {
            available: true,
            rtpCapabilities: router.rtpCapabilities
          };
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message
          });
          throw error;
        } finally {
          span.end();
        }
      })
  });

  if (!state.enabled) {
    state.healthy = false;
    state.detail = "Servidor de medios deshabilitado por configuración";
    return;
  }

  await tracer.startActiveSpan("media.worker.bootstrap", async (span) => {
    span.setAttribute("corelia.media.enabled", state.enabled);
    try {
      const mediasoupModuleName = "mediasoup";
      const mediasoup = (await import(mediasoupModuleName)) as {
        createWorker: (input: {
          rtcMinPort: number;
          rtcMaxPort: number;
          logLevel: "error" | "warn" | "debug" | "none";
        }) => Promise<{
          on: (event: "died", listener: () => void) => void;
          close: () => void;
          createRouter: (input: { mediaCodecs: Array<Record<string, unknown>> }) => Promise<{
            rtpCapabilities: unknown;
            close: () => void;
          }>;
        }>;
      };

      const worker = await mediasoup.createWorker({
        rtcMinPort: env.MEDIA_MIN_PORT,
        rtcMaxPort: env.MEDIA_MAX_PORT,
        logLevel: "warn"
      });

      worker.on("died", () => {
        state.healthy = false;
        state.detail = "Worker mediasoup detenido inesperadamente";
      });

      state.worker = worker;
      state.healthy = true;
      state.detail = null;
    } catch (error) {
      state.healthy = false;
      state.detail = `Modo degradado de videollamadas: ${(error as Error).message}`;
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message
      });
    } finally {
      span.end();
    }
  });

  app.addHook("onClose", async () => {
    if (state.worker) {
      (state.worker as { close: () => void }).close();
    }
    for (const room of state.rooms.values()) {
      (room as { close: () => void }).close();
    }
    state.rooms.clear();
  });
});
