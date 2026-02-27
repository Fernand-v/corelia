import { describe, expect, it } from "vitest";
import { cn } from "./utils.js";

describe("ui utils", () => {
  it("merges class names", () => {
    expect(cn("a", undefined, "b")).toBe("a b");
  });
});
