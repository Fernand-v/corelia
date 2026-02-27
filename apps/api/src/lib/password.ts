import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export const hashPassword = async (rawPassword: string): Promise<string> => {
  return bcrypt.hash(rawPassword, SALT_ROUNDS);
};

export const verifyPassword = async (rawPassword: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(rawPassword, hash);
};
