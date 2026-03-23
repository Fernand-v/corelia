import { PrismaClient } from "@prisma/client";
import { MeiliSearchIndex, resolveSearchIndexEnv } from "../apps/api/src/modules/search/search-index.js";

const prisma = new PrismaClient();

const logger = {
  info: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args)
};

const main = async () => {
  const env = resolveSearchIndexEnv(process.env);

  if (!env.MEILISEARCH_ENABLED) {
    throw new Error("Activa MEILISEARCH_ENABLED=true antes de reconstruir el índice");
  }

  const searchIndex = new MeiliSearchIndex({
    prisma,
    logger,
    env
  });

  const result = await searchIndex.reindexAll();
  logger.info(`Reindexado completado. Documentos indexados: ${result.indexed}`);
};

try {
  await main();
} catch (error) {
  logger.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
