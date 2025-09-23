import prisma from "./prisma.js";
import { ServiceCache, CACHE_TTL } from "./ServiceCache.js";

export { CACHE_TTL };

export class ServicePattern {
  constructor(serviceName, key, include = {}, select = {}, options = {}) {
    this.serviceName = serviceName;
    this.key = key;
    this.include = include;
    this.select = select;
    this.serviceCache = new ServiceCache(serviceName);

    // Field naming options for flexibility
    this.yearField = options.yearField || "tanev_kezdete"; // Default to tanev_kezdete
    this.alapadatokField = options.alapadatokField || "alapadatok_id"; // Default to alapadatok_id
    this.orderBy = options.orderBy || undefined; // Default ordering option
  }

  /**
   * Helper method to get current academic year
   */
  getCurrentAcademicYear() {
    let year = new Date().getFullYear();
    const month = new Date().getMonth();

    // If month is before June (0-based), we're in the previous academic year
    if (month < 6) {
      year -= 1;
    }

    return year;
  }

  /**
   * Helper method to get year range for queries
   */
  getYearRange(year) {
    const targetYear = parseInt(year);
    return {
      firstYear: targetYear - 4,
      lastYear: targetYear,
    };
  }

  async findAll() {
    return await this.serviceCache.get(
      "all",
      async () => {
        return await prisma[this.serviceName].findMany({
          include: this.include,
          select: Object.keys(this.select).length > 0 ? this.select : undefined,
          orderBy: this.orderBy,
        });
      },
      CACHE_TTL.SHORT
    );
  }

  async findAllByYear(year) {
    const firstYear = parseInt(year) - 4;
    const lastYear = parseInt(year);

    return await this.serviceCache.get(
      "byYear",
      async () => {
        return await prisma[this.serviceName].findMany({
          where: { [this.yearField]: { gte: firstYear, lte: lastYear } },
          include: this.include,
          select: Object.keys(this.select).length > 0 ? this.select : undefined,
        });
      },
      CACHE_TTL.SHORT,
      year
    );
  }

  async findById(id) {
    return await this.serviceCache.get(
      "id",
      async () => {
        return await prisma[this.serviceName].findUnique({
          where: { [this.key]: id },
          include: this.include,
          select: Object.keys(this.select).length > 0 ? this.select : undefined,
        });
      },
      CACHE_TTL.MEDIUM,
      id
    );
  }

  async findAllByAlapadatok(alapadatokId) {
    return await this.serviceCache.get(
      "alapadatok_id",
      async () => {
        return await prisma[this.serviceName].findMany({
          where: { [this.alapadatokField]: alapadatokId },
          include: this.include,
          select: Object.keys(this.select).length > 0 ? this.select : undefined,
        });
      },
      CACHE_TTL.SHORT,
      alapadatokId
    );
  }

  async findByAlapadatokIdAndYear(alapadatokId, year) {
    const firstYear = parseInt(year) - 4;
    const lastYear = parseInt(year);

    return await this.serviceCache.get(
      "alapadatok_id_year",
      async () => {
        return await prisma[this.serviceName].findMany({
          where: {
            [this.alapadatokField]: alapadatokId,
            [this.yearField]: { gte: firstYear, lte: lastYear },
          },
          include: this.include,
          select: Object.keys(this.select).length > 0 ? this.select : undefined,
        });
      },
      CACHE_TTL.SHORT,
      alapadatokId,
      year
    );
  }

  async create(data) {
    const result = await prisma[this.serviceName].create({
      data,
      include: this.include,
      select: Object.keys(this.select).length > 0 ? this.select : undefined,
    });

    // Invalidate related caches
    this.serviceCache.invalidateRelated("create", result[this.key]);

    return result;
  }

  async createMany(data) {
    const result = await prisma[this.serviceName].createMany({
      data,
      skipDuplicates: true, // Add skipDuplicates for safety
    });

    // Invalidate all cache for bulk operations
    this.serviceCache.invalidateRelated("createMany");

    return result;
  }

  async update(id, data) {
    const result = await prisma[this.serviceName].update({
      where: { [this.key]: id },
      data,
      include: this.include,
      select: Object.keys(this.select).length > 0 ? this.select : undefined,
    });

    // Invalidate related caches
    this.serviceCache.invalidateRelated("update", id);

    return result;
  }

  async delete(id) {
    const result = await prisma[this.serviceName].delete({
      where: { [this.key]: id },
      include: this.include,
      select: Object.keys(this.select).length > 0 ? this.select : undefined,
    });

    // Invalidate related caches
    this.serviceCache.invalidateRelated("delete", id);

    return result;
  }

  async deleteByAlapadatokId(alapadatokId) {
    const result = await prisma[this.serviceName].deleteMany({
      where: { [this.alapadatokField]: alapadatokId },
    });

    // Invalidate related caches
    this.serviceCache.invalidateRelated("deleteMany", alapadatokId);

    return result;
  }

  async deleteByAlapadatokIdAndYear(alapadatokId, year) {
    const { firstYear, lastYear } = this.getYearRange(year);

    const result = await prisma[this.serviceName].deleteMany({
      where: {
        [this.alapadatokField]: alapadatokId,
        [this.yearField]: { gte: firstYear, lte: lastYear },
      },
    });

    // Invalidate related caches
    this.serviceCache.invalidateRelated("deleteMany", alapadatokId);

    return result;
  }

  async deleteByAlapadatokIdAndExactYear(alapadatokId, year) {
    const targetYear = parseInt(year);
    const result = await prisma[this.serviceName].deleteMany({
      where: {
        [this.alapadatokField]: alapadatokId,
        [this.yearField]: targetYear,
      },
    });

    // Invalidate related caches
    this.serviceCache.invalidateRelated("deleteMany", alapadatokId);

    return result;
  }

  /**
   * Additional convenience methods for common patterns
   */

  /**
   * Find all records for current academic year
   */
  async findAllCurrentYear() {
    const currentYear = this.getCurrentAcademicYear();
    return await this.findAllByYear(currentYear);
  }

  /**
   * Find records by alapadatok for current academic year
   */
  async findByAlapadatokCurrentYear(alapadatokId) {
    const currentYear = this.getCurrentAcademicYear();
    return await this.findByAlapadatokIdAndYear(alapadatokId, currentYear);
  }

  /**
   * Count records with caching
   */
  async count(where = {}) {
    return await this.serviceCache.get(
      "count",
      async () => {
        return await prisma[this.serviceName].count({ where });
      },
      CACHE_TTL.SHORT,
      JSON.stringify(where)
    );
  }

  /**
   * Check if record exists by ID
   */
  async exists(id) {
    const record = await this.findById(id);
    return record !== null;
  }

  /**
   * Bulk delete with proper cache invalidation
   */
  async deleteMany(where) {
    const result = await prisma[this.serviceName].deleteMany({ where });

    // Invalidate all cache for bulk operations
    this.serviceCache.invalidateRelated("deleteMany");

    return result;
  }
}
