import bcrypt from "bcryptjs";

// Bcrypt rounds - higher is more secure but slower
const BCRYPT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 * @param {string} password - The plain text password to hash
 * @returns {Promise<string>} - A promise resolving to the hashed password
 */
export async function hashPassword(password) {
  if (!password) {
    throw new Error("Password is required");
  }

  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare a password with a hash
 * @param {string} password - The plain text password
 * @param {string} hash - The hashed password to compare against
 * @returns {Promise<boolean>} - A promise resolving to true if the password matches
 */
export async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}
