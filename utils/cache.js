import process from "node:process";

const REDIS_URL = process.env.REDIS_URL;

let redisClient = null;
let useRedis = false;

// Fallback memory cache
const memoryCache = new Map();
const MAX_CACHE_SIZE = 10000;
const DEFAULT_TTL = 5 * 60 * 1000;

// Initialize Redis if URL is provided
if (REDIS_URL) {
  import("redis")
    .then(({ createClient }) => {
      redisClient = createClient({ url: REDIS_URL });

      redisClient.on("error", (err) => {
        console.error("Redis Client Error:", err.message);
        useRedis = false; // Fallback to memory on error
      });

      redisClient.on("ready", () => {
        console.log("Redis connected successfully");
        useRedis = true;
      });

      redisClient.connect().catch((err) => {
        console.error("Failed to connect to Redis:", err.message);
      });
    })
    .catch((err) => {
      console.warn("Redis client not installed, using in-memory cache fallback.");
    });
}

/**
 * Evict expired entries and enforce max size limit for memory cache
 */
function evictIfNeeded() {
  const now = Date.now();
  for (const [key, item] of memoryCache.entries()) {
    if (item.expiry && item.expiry < now) {
      memoryCache.delete(key);
    }
  }
  if (memoryCache.size > MAX_CACHE_SIZE) {
    const entriesToRemove = memoryCache.size - MAX_CACHE_SIZE;
    let removed = 0;
    for (const key of memoryCache.keys()) {
      if (removed >= entriesToRemove) break;
      memoryCache.delete(key);
      removed++;
    }
  }
}

// Periodic cleanup timer for memory cache
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  if (!useRedis) evictIfNeeded();
}, CLEANUP_INTERVAL);

if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

/**
 * Get a value from the cache
 * @param {string} key - The cache key
 * @returns {Promise<any|null>} - The cached value or null if not found/expired
 */
export async function get(key) {
  if (useRedis) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error("Redis get error:", err.message);
      return null;
    }
  } else {
    const item = memoryCache.get(key);
    if (!item) return null;
    if (item.expiry && item.expiry < Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    return item.value;
  }
}

/**
 * Set a value in the cache
 * @param {string} key - The cache key
 * @param {any} value - The value to cache
 * @param {number|null} ttl - Time to live in milliseconds
 */
export async function set(key, value, ttl = DEFAULT_TTL) {
  if (useRedis) {
    try {
      const strValue = JSON.stringify(value);
      if (ttl) {
        await redisClient.setEx(key, Math.floor(ttl / 1000), strValue);
      } else {
        await redisClient.set(key, strValue);
      }
    } catch (err) {
      console.error("Redis set error:", err.message);
    }
  } else {
    if (!memoryCache.has(key) && memoryCache.size >= MAX_CACHE_SIZE) {
      evictIfNeeded();
    }
    const expiry = ttl ? Date.now() + ttl : null;
    memoryCache.set(key, { value, expiry });
  }
}

/**
 * Check if a key exists in the cache and is not expired
 * @param {string} key - The cache key
 * @returns {Promise<boolean>} - True if the key exists and is not expired
 */
export async function has(key) {
  if (useRedis) {
    try {
      return (await redisClient.exists(key)) === 1;
    } catch (err) {
      console.error("Redis has error:", err.message);
      return false;
    }
  } else {
    const item = memoryCache.get(key);
    if (!item) return false;
    if (item.expiry && item.expiry < Date.now()) {
      memoryCache.delete(key);
      return false;
    }
    return true;
  }
}

/**
 * Delete a specific key from the cache
 * @param {string} key - The cache key
 */
export async function del(key) {
  if (useRedis) {
    try {
      await redisClient.del(key);
    } catch (err) {
      console.error("Redis del error:", err.message);
    }
  } else {
    memoryCache.delete(key);
  }
}

/**
 * Delete all keys that match a pattern
 * @param {string} pattern - The pattern to match keys against
 */
export async function delByPattern(pattern) {
  if (useRedis) {
    try {
      // Fetch all keys and filter by regex.
      // (For larger production datasets, use SCAN or convert regex to redis glob)
      const keys = await redisClient.keys("*");
      const regex = new RegExp(pattern);
      const keysToDelete = keys.filter((k) => regex.test(k));
      if (keysToDelete.length > 0) {
        await redisClient.del(keysToDelete);
      }
    } catch (err) {
      console.error("Redis delByPattern error:", err.message);
    }
  } else {
    const regex = new RegExp(pattern);
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
      }
    }
  }
}

/**
 * Clear the entire cache
 */
export async function clear() {
  if (useRedis) {
    try {
      await redisClient.flushDb();
    } catch (err) {
      console.error("Redis clear error:", err.message);
    }
  } else {
    memoryCache.clear();
  }
}

/**
 * Get stats about the cache
 * @returns {Promise<Object>} - Stats about the cache
 */
export async function stats() {
  if (useRedis) {
    return {
      type: "redis",
      connected: useRedis,
    };
  } else {
    let size = 0;
    let expired = 0;
    const now = Date.now();
    for (const [_, item] of memoryCache.entries()) {
      if (item.expiry && item.expiry < now) {
        expired++;
      } else {
        size++;
      }
    }
    return {
      type: "memory",
      size,
      expired,
      total: memoryCache.size,
      maxSize: MAX_CACHE_SIZE,
    };
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
    const cachedData = await get(key);

    if (cachedData !== null) {
      return cachedData;
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
