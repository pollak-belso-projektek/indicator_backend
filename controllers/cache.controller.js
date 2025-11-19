import e from "express";
import * as cache from "../utils/cache.js";

const router = e.Router();

/**
 * @swagger
 * tags:
 *   name: Cache
 *   description: Cache management endpoints
 *
 * components:
 *   schemas:
 *     CacheStats:
 *       type: object
 *       properties:
 *         size:
 *           type: integer
 *           description: Number of active items in cache
 *           example: 42
 *         expired:
 *           type: integer
 *           description: Number of expired items still in cache
 *           example: 5
 *         total:
 *           type: integer
 *           description: Total number of items in cache (active + expired)
 *           example: 47
 */

/**
 * @swagger
 * /cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     description: Retrieves statistics about the current state of the cache
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/CacheStats'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
// Get cache stats
router.get("/stats", async (req, res) => {
  const stats = await cache.stats();
  res.json({
    status: "success",
    data: stats,
  });
});

/**
 * @swagger
 * /cache/clear:
 *   post:
 *     summary: Clear entire cache
 *     description: Deletes all cached items
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Cache cleared successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
// Clear cache (admin only)
router.post("/clear", async (req, res) => {
  await cache.clear();
  res.json({
    status: "success",
    message: "Cache cleared successfully",
  });
});

/**
 * @swagger
 * /cache/clear/{pattern}:
 *   post:
 *     summary: Clear cache by pattern
 *     description: Deletes all cached items matching the specified pattern
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pattern
 *         required: true
 *         schema:
 *           type: string
 *         description: Pattern to match cache keys (e.g., 'users:*')
 *         example: users:*
 *     responses:
 *       200:
 *         description: Cache keys matching pattern cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Cache matching pattern 'users:*' cleared successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
// Clear specific pattern
router.post("/clear/:pattern", async (req, res) => {
  const { pattern } = req.params;
  await cache.delByPattern(pattern);
  res.json({
    status: "success",
    message: `Cache matching pattern '${pattern}' cleared successfully`,
  });
});

export default router;
