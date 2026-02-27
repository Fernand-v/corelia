import { createHash, randomBytes } from "node:crypto";

export const createOpaqueToken = (): string => {
  return randomBytes(48).toString("base64url");
};

export const hashOpaqueToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};
