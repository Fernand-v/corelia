import type { PrismaClient } from "@prisma/client";

type SchemaRequirement = {
  table: string;
  column?: string;
};

type ReadinessProbeResult =
  | { ready: true }
  | { ready: false; missing: string[] };

type ReadinessLogger = Pick<Console, "warn">;

type ReadinessGateOptions = {
  name: string;
  probe: () => Promise<ReadinessProbeResult>;
  timeoutMs?: number;
  retryDelayMs?: number;
  logger?: ReadinessLogger;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const schemaRequirementLabel = ({ table, column }: SchemaRequirement) =>
  column ? `${table}.${column}` : table;

const schemaEntryExists = async (
  prisma: PrismaClient,
  requirement: SchemaRequirement
) => {
  if (requirement.column) {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${requirement.table}
          AND column_name = ${requirement.column}
      ) AS "exists"
    `;

    return result[0]?.exists === true;
  }

  const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${requirement.table}
    ) AS "exists"
  `;

  return result[0]?.exists === true;
};

const findMissingSchemaRequirements = async (
  prisma: PrismaClient,
  requirements: SchemaRequirement[]
) => {
  const missing: string[] = [];

  for (const requirement of requirements) {
    if (!(await schemaEntryExists(prisma, requirement))) {
      missing.push(schemaRequirementLabel(requirement));
    }
  }

  return missing;
};

export const createReadinessGate = ({
  name,
  probe,
  timeoutMs = 60_000,
  retryDelayMs = 2_000,
  logger = console
}: ReadinessGateOptions) => {
  let ready = false;
  let inFlight: Promise<boolean> | null = null;
  let lastWarning = "";

  const warnOnce = (message: string) => {
    if (message === lastWarning) {
      return;
    }

    lastWarning = message;
    logger.warn(message);
  };

  return async () => {
    if (ready) {
      return true;
    }

    if (inFlight) {
      return inFlight;
    }

    inFlight = (async () => {
      const deadline = Date.now() + timeoutMs;

      while (true) {
        try {
          const result = await probe();
          if (result.ready) {
            ready = true;
            return true;
          }

          warnOnce(
            `[workers] waiting for ${name}; missing schema: ${result.missing.join(", ")}`
          );
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          warnOnce(`[workers] waiting for ${name}; database not ready (${detail})`);
        }

        if (Date.now() >= deadline) {
          break;
        }

        await sleep(retryDelayMs);
      }

      logger.warn(`[workers] skipped ${name}; schema/database not ready after ${timeoutMs}ms`);
      return false;
    })().finally(() => {
      inFlight = null;
    });

    return inFlight;
  };
};

export const createPrismaSchemaGate = (
  prisma: PrismaClient,
  name: string,
  requirements: SchemaRequirement[],
  options?: Omit<ReadinessGateOptions, "name" | "probe">
) =>
  createReadinessGate({
    name,
    ...(options?.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options?.retryDelayMs === undefined ? {} : { retryDelayMs: options.retryDelayMs }),
    ...(options?.logger === undefined ? {} : { logger: options.logger }),
    probe: async () => {
      const missing = await findMissingSchemaRequirements(prisma, requirements);
      return missing.length === 0 ? { ready: true } : { ready: false, missing };
    }
  });
