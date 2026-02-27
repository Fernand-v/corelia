import { describe, expect, it } from "vitest";
import { createQueryClient } from "@/lib/query-client";

describe("web setup", () => {
  it("creates query client", () => {
    const client = createQueryClient();
    expect(client).toBeDefined();
  });
});
