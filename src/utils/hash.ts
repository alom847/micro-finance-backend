import * as CryptoJS from "crypto-js";

function hash(password: string, salt?: string): string {
  const hashedPassword = CryptoJS.AES.encrypt(
    password,
    salt ?? (process.env.SALT as string)
  ).toString();

  return hashedPassword;
}

function compareHash(
  plainTextPassword: string,
  hashedPassword: string,
  salt?: string
): boolean {
  const decrypted_pass = CryptoJS.AES.decrypt(
    hashedPassword,
    salt ?? (process.env.SALT as string)
  ).toString(CryptoJS.enc.Utf8);

  return plainTextPassword === decrypted_pass;
}

export { hash, compareHash };
