import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, BCRYPT_ROUNDS);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);
