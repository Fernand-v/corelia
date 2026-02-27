import fp from "fastify-plugin";
import { prisma } from "../lib/prisma.js";

export const prismaPlugin = fp(async (app) => {
  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await app.prisma.$disconnect();
  });
});
