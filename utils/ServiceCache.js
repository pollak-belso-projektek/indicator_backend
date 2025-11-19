import * as cache from "./cache.js";

export const CACHE_TTL = {
  VERY_SHORT: 1 * 60 * 1000, // 1 minute - for frequently changing data
  SHORT: 5 * 60 * 1000, // 5 minutes - for lists
  MEDIUM: 10 * 60 * 1000, // 10 minutes - for details
  LONG: 30 * 60 * 1000, // 30 minutes - for relatively static data
  VERY_LONG: 60 * 60 * 1000, // 1 hour - for very static data
};

export class ServiceCache {
  constructor(serviceName) {
    this.serviceName = serviceName;
  }

  /**
   * Generate consistent cache keys
   */
  key(operation, ...params) {
    const cleanParams = params.filter((p) => p !== null && p !== undefined);
    return `${this.serviceName}:${operation}:${cleanParams.join(":")}`;
  }

  /**
   * Get data with caching
   */
  async get(operation, queryFn, ttl = CACHE_TTL.SHORT, ...params) {
    const cacheKey = this.key(operation, ...params);

    // Try to get from cache first
    let data = await cache.get(cacheKey);
    if (data !== null) {
      return data;
    }

    // Execute query and cache result
    data = await queryFn();
    await cache.set(cacheKey, data, ttl);

    return data;
  }

  /**
   * Invalidate cache patterns for this service
   */
  async invalidate(...patterns) {
    for (const pattern of patterns) {
      const fullPattern = `${this.serviceName}:${pattern}`;
      await cache.delByPattern(fullPattern);
    }
  }

  /**
   * Invalidate all cache for this service
   */
  async invalidateAll() {
    await cache.delByPattern(`${this.serviceName}:.*`);
  }

  /**
   * Smart cache invalidation based on operations
   */
  async invalidateRelated(operation, ...params) {
    switch (operation) {
      case "create":
      case "update":
      case "delete":
        // Invalidate lists and specific items
        await this.invalidate(
          "all.*",
          "byYear.*",
          "alapadatok_id.*",
          "count.*"
        );
        if (params[0]) {
          // If ID provided, invalidate specific item patterns
          await this.invalidate(`id:${params[0]}.*`);
          // Also invalidate any alapadatok-related caches if this affects them
          await this.invalidate(`alapadatok_id:${params[0]}.*`);
        }
        break;
      case "createMany":
      case "deleteMany":
        // Invalidate all for bulk operations
        await this.invalidateAll();
        break;
      default:
        // For unknown operations, invalidate commonly affected patterns
        await this.invalidate("all.*", "count.*");
    }
  }

  /**
   * Invalidate caches for a specific alapadatok_id
   */
  async invalidateByAlapadatokId(alapadatokId) {
    await this.invalidate(`alapadatok_id:${alapadatokId}.*`);
    await this.invalidate("all.*", "count.*"); // Also invalidate general lists
  }

  /**
   * Invalidate caches for a specific year
   */
  async invalidateByYear(year) {
    await this.invalidate(`byYear:${year}.*`);
    await this.invalidate(`alapadatok_id_year:.*:${year}.*`);
    await this.invalidate("all.*"); // Also invalidate general lists
  }

  /**
   * Get cache statistics for this service
   */
  async getStats() {
    // This would require extending the cache utility to support pattern-based stats
    // For now, return general cache stats
    return await cache.stats();
  }
}
