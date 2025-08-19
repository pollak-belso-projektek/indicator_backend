import prisma, { withRetry } from "../utils/prisma.js";

/**
 * Database service class that provides common database operations with retry logic
 */
class DatabaseService {
  constructor() {
    this.prisma = prisma;
  }

  /**
   * Execute a database operation with retry logic
   * @param {Function} operation - The database operation to execute
   * @param {Object} options - Retry configuration options
   * @returns {Promise} - The result of the operation
   */
  async executeWithRetry(operation, options = {}) {
    return withRetry(operation, options);
  }

  /**
   * Check if the database is available
   * @returns {Promise<boolean>} - True if database is available
   */
  async isAvailable() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error("Database availability check failed:", error);
      return false;
    }
  }

  /**
   * Get database connection info
   * @returns {Promise<Object>} - Database connection information
   */
  async getConnectionInfo() {
    try {
      const result = await prisma.$queryRaw`
        SELECT 
          current_database() as database_name,
          version() as version,
          current_user as user,
          inet_server_addr() as host,
          inet_server_port() as port
      `;
      return result[0];
    } catch (error) {
      console.error("Failed to get database connection info:", error);
      throw error;
    }
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>} - Database statistics
   */
  async getStats() {
    try {
      const [activeConnections, dbSize] = await Promise.all([
        prisma.$queryRaw`
          SELECT count(*) as active_connections 
          FROM pg_stat_activity 
          WHERE state = 'active'
        `,
        prisma.$queryRaw`
          SELECT 
            pg_size_pretty(pg_database_size(current_database())) as database_size,
            current_database() as database_name
        `,
      ]);

      return {
        activeConnections: Number(activeConnections[0].active_connections),
        databaseSize: dbSize[0].database_size,
        databaseName: dbSize[0].database_name,
      };
    } catch (error) {
      console.error("Failed to get database statistics:", error);
      throw error;
    }
  }

  /**
   * Execute a transaction with retry logic
   * @param {Function} transactionFn - Function that defines the transaction
   * @param {Object} options - Transaction and retry options
   * @returns {Promise} - The result of the transaction
   */
  async executeTransaction(transactionFn, options = {}) {
    const { retryOptions, ...transactionOptions } = options;

    return withRetry(async () => {
      return prisma.$transaction(transactionFn, transactionOptions);
    }, retryOptions);
  }

  /**
   * Safely execute a raw query with retry logic
   * @param {String} query - Raw SQL query
   * @param {Array} params - Query parameters
   * @param {Object} retryOptions - Retry configuration
   * @returns {Promise} - Query result
   */
  async executeRawQuery(query, params = [], retryOptions = {}) {
    return withRetry(() => {
      return prisma.$queryRaw(query, ...params);
    }, retryOptions);
  }

  /**
   * Bulk operations with retry logic
   * @param {String} model - Prisma model name
   * @param {String} operation - Operation type (createMany, updateMany, deleteMany)
   * @param {Object} data - Operation data
   * @param {Object} retryOptions - Retry configuration
   * @returns {Promise} - Operation result
   */
  async executeBulkOperation(model, operation, data, retryOptions = {}) {
    return withRetry(() => {
      return prisma[model][operation](data);
    }, retryOptions);
  }
}

// Export singleton instance
const databaseService = new DatabaseService();
export default databaseService;
