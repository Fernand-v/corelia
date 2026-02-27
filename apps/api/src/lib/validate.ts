import type { ZodTypeAny } from "zod";

export const parseWithSchema = <T extends ZodTypeAny>(schema: T, data: unknown) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => issue.message);
    const error = new Error(issues.join(", "));
    error.name = "ValidationError";
    throw error;
  }

  return result.data;
};
