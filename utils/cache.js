/**
 * Redis cache utility
 * Provides general-purpose caching with TTL support using Redis
 */

import Redis from "ioredis";
import process from "node:process";

// Default TTL in milliseconds (5 minutes)
const DEFAULT_TTL = 5 * 60 * 1000;

// Initialize Redis client
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    // Retry connection with exponential backoff, max 3 seconds
    const delay = Math.min(times * 50, 3000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

/**
 * Get a value from the cache
 * @param {string} key - The cache key
 * @returns {Promise<any|null>} - The cached value or null if not found/expired
 */
export async function get(key) {
  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value);
  } catch (error) {
    console.error(`Cache get error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set a value in the cache
 * @param {string} key - The cache key
 * @param {any} value - The value to cache
 * @param {number|null} ttl - Time to live in milliseconds (default: 5 minutes)
 */
export async function set(key, value, ttl = DEFAULT_TTL) {
  try {
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      await redis.set(key, serializedValue, "PX", ttl);
    } else {
      await redis.set(key, serializedValue);
    }
  } catch (error) {
    console.error(`Cache set error for key ${key}:`, error);
  }
}

/**
 * Check if a key exists in the cache
 * @param {string} key - The cache key
 * @returns {Promise<boolean>} - True if the key exists
 */
export async function has(key) {
  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.error(`Cache has error for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete a specific key from the cache
 * @param {string} key - The cache key
 */
export async function del(key) {
  try {
    await redis.del(key);
  } catch (error) {
    console.error(`Cache del error for key ${key}:`, error);
  }
}

/**
 * Delete all keys that match a pattern
 * @param {string} pattern - The pattern to match keys against (e.g. 'users:*')
 */
export async function delByPattern(pattern) {
  try {
    const stream = redis.scanStream({
      match: pattern,
      count: 100,
    });

    stream.on("data", async (keys) => {
      if (keys.length) {
        const pipeline = redis.pipeline();
        keys.forEach((key) => {
          pipeline.del(key);
        });
        await pipeline.exec();
      }
    });

    return new Promise((resolve, reject) => {
      stream.on("end", () => resolve());
      stream.on("error", (err) => reject(err));
    });
  } catch (error) {
    console.error(`Cache delByPattern error for pattern ${pattern}:`, error);
  }
}

/**
 * Clear the entire cache
 */
export async function clear() {
  try {
    await redis.flushdb();
  } catch (error) {
    console.error("Cache clear error:", error);
  }
}

/**
 * Get stats about the cache
 * @returns {Promise<Object>} - Stats about the cache
 */
export async function stats() {
  try {
    const info = await redis.info();
    const dbSize = await redis.dbsize();
    
    // Parse info string to get relevant stats
    const usedMemory = info.match(/used_memory_human:(\S+)/)?.[1] || "unknown";
    const connectedClients = info.match(/connected_clients:(\d+)/)?.[1] || "0";

    return {
      size: dbSize,
      usedMemory,
      connectedClients: parseInt(connectedClients, 10),
      type: "redis"
    };
  } catch (error) {
    console.error("Cache stats error:", error);
    return { size: 0, error: error.message };
  }
}

/**
 * Wrap an async function with caching
 * @param {Function} fn - The function to wrap
 * @param {string} keyPrefix - Prefix for the cache key
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Function} - The wrapped function
 */
export function cached(fn, keyPrefix, ttl = DEFAULT_TTL) {
  return async (...args) => {
    const key = `${keyPrefix}:${JSON.stringify(args)}`;
    const cachedValue = await get(key);

    if (cachedValue !== null) {
      return cachedValue;
    }

    const result = await fn(...args);
    await set(key, result, ttl);
    return result;
  };
}

/**
 * Convenience function to invalidate cache entries by pattern
 * @param {string} pattern - The pattern to match (e.g., 'users:*')
 * @returns {Promise<boolean>} - Always returns true for ease of use
 */
export async function invalidate(pattern) {
  await delByPattern(pattern);
  return true;
}

export default redis;
