/**
 * Simple in-memory cache utility
 * Provides general-purpose caching with TTL support for the login service
 */

// Main cache store
const cache = new Map();

// Default TTL in milliseconds (5 minutes)
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Get a value from the cache
 * @param {string} key - The cache key
 * @returns {any|null} - The cached value or null if not found/expired
 */
export function get(key) {
  const item = cache.get(key);

  // Return null if not in cache or key doesn't exist
  if (!item) return null;

  // Check if item has expired
  if (item.expiry && item.expiry < Date.now()) {
    cache.delete(key); // Clean up expired item
    return null;
  }

  return item.value;
}

/**
 * Set a value in the cache
 * @param {string} key - The cache key
 * @param {any} value - The value to cache
 * @param {number|null} ttl - Time to live in milliseconds (default: 5 minutes)
 */
export function set(key, value, ttl = DEFAULT_TTL) {
  const expiry = ttl ? Date.now() + ttl : null;

  cache.set(key, {
    value,
    expiry,
  });
}

/**
 * Check if a key exists in the cache and is not expired
 * @param {string} key - The cache key
 * @returns {boolean} - True if the key exists and is not expired
 */
export function has(key) {
  return get(key) !== null;
}

/**
 * Delete a key from the cache
 * @param {string} key - The cache key
 * @returns {boolean} - True if the key was deleted, false if it didn't exist
 */
export function del(key) {
  return cache.delete(key);
}

/**
 * Clear the entire cache
 */
export function clear() {
  cache.clear();
}

/**
 * Get cache statistics
 * @returns {object} - Cache statistics
 */
export function stats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
