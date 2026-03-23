import fp from "fastify-plugin";
import { MeiliSearchIndex, resolveSearchIndexEnv } from "../modules/search/search-index.js";

export const searchIndexPlugin = fp(async (app) => {
  const searchIndex = new MeiliSearchIndex({
    prisma: app.prisma,
    logger: app.log,
    env: resolveSearchIndexEnv(process.env)
  });

  app.decorate("searchIndex", searchIndex);
  await searchIndex.initialize();
});
