import bcrypt from "bcryptjs";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

// Hash de contraseñas con argon2id (prebuilt, sin node-gyp). Se mantiene la
// verificación de hashes bcrypt heredados para no invalidar credenciales
// existentes; los nuevos hashes son argon2id.
export const hashPassword = async (rawPassword: string): Promise<string> => {
  return argon2Hash(rawPassword);
};

export const verifyPassword = async (rawPassword: string, hash: string): Promise<boolean> => {
  if (hash.startsWith("$argon2")) {
    try {
      return await argon2Verify(hash, rawPassword);
    } catch {
      return false;
    }
  }
  // Hash heredado (bcrypt): $2a$/$2b$/$2y$.
  return bcrypt.compare(rawPassword, hash);
};
