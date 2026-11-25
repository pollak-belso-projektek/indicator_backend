import e from "express";
import * as logService from "../services/log.service.js";

const router = e.Router();

/**
 * @swagger
 * tags:
 *   name: Logs
 *   description: Log management endpoints
 *
 * components:
 *   schemas:
 *     LogEntry:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The log entry ID
 *           format: uuid
 *         userId:
 *           type: string
 *           description: The user ID associated with the request (if authenticated)
 *           format: uuid
 *           nullable: true
 *         method:
 *           type: string
 *           description: The HTTP method of the request
 *           example: GET
 *         path:
 *           type: string
 *           description: The request path
 *           example: /api/v1/users
 *         statusCode:
 *           type: integer
 *           description: The HTTP status code of the response
 *           example: 200
 *         body:
 *           type: object
 *           description: The request body (if any)
 *           nullable: true
 *         query:
 *           type: object
 *           description: The query parameters
 *           nullable: true
 *         duration:
 *           type: integer
 *           description: The request duration in milliseconds
 *           example: 45
 *           nullable: true
 *         level:
 *           type: string
 *           description: The log level
 *           example: INFO
 *           enum: [INFO, WARN, ERROR]
 *         correlationId:
 *           type: string
 *           description: ID to correlate related requests
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The timestamp when the log was created
 *     LogListResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LogEntry'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 50
 *             total:
 *               type: integer
 *               example: 320
 *             pages:
 *               type: integer
 *               example: 7
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: error
 *         message:
 *           type: string
 */

/**
 * @swagger
 * /logs:
 *   get:
 *     summary: Get system logs
 *     description: Retrieves paginated system logs with filtering options
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *       - name: userId
 *         in: query
 *         schema:
 *           type: string
 *       - name: level
 *         in: query
 *         schema:
 *           type: string
 *           enum: [INFO, WARN, ERROR]
 *       - name: path
 *         in: query
 *         schema:
 *           type: string
 *       - name: method
 *         in: query
 *         schema:
 *           type: string
 *           enum: [GET, POST, PUT, DELETE, PATCH]
 *       - name: startDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: List of logs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LogListResponse'
 *       401:
 *         description: Unauthorized - user is not authenticated
 *       500:
 *         description: Server error while fetching logs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      userId,
      level,
      path,
      method,
      startDate,
      endDate,
    } = req.query;

    const filters = {
      userId,
      level,
      path,
      method,
    };

    // Add date range if provided
    if (startDate || endDate) {
      filters.dateRange = {};

      if (startDate) {
        filters.dateRange.start = new Date(startDate);
      }

      if (endDate) {
        filters.dateRange.end = new Date(endDate);
      }
    }

    const result = await logService.getLogsWithPagination({
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      ...filters,
    });

    res.json({
      status: "success",
      data: result.logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.total,
        pages: Math.ceil(result.total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch logs" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const stats = await logService.getLogStats(cutoffDate);

    res.json({
      status: "success",
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching log statistics:", error);
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch log statistics" });
  }
});

router.delete("/", async (req, res) => {
  try {
    const { before, level, method } = req.query;

    if (!before && !level && !method) {
      return res.status(400).json({
        status: "error",
        message: "Legalább egy törlési feltételt meg kell adni!",
      });
    }

    let beforeDate;
    if (before) {
      beforeDate = new Date(before);
      if (Number.isNaN(beforeDate.getTime())) {
        return res.status(400).json({
          status: "error",
          message: "Érvénytelen dátum formátum!",
        });
      }
    }

    const deletedCount = await logService.deleteLogs({
      before: beforeDate,
      level: level || undefined,
      method: method || undefined,
    });

    res.json({
      status: "success",
      message: "A naplók sikeresen törölve lettek.",
      deletedCount,
    });
  } catch (error) {
    console.error("Error deleting logs:", error);
    res.status(500).json({ status: "error", message: "Hiba történt a naplók törlése során." });
  }
});

/**
 * @swagger
 * /logs/{id}:
 *   get:
 *     summary: Get log details
 *     description: Retrieves details for a specific log entry
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Log entry details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/LogEntry'
 *       404:
 *         description: Log entry not found
 *       500:
 *         description: Server error
 */
router.get("/:id", async (req, res) => {
  try {
    const log = await logService.getLogById(req.params.id);

    if (!log) {
      return res.status(404).json({
        status: "error",
        message: "Log entry not found",
      });
    }

    res.json({
      status: "success",
      data: log,
    });
  } catch (error) {
    console.error("Error fetching log entry:", error);
    res
      .status(500)
      .json({ status: "error", message: "Failed to fetch log entry" });
  }
});

/**
 * @swagger
 * /logs/clear:
 *   post:
 *     summary: Clear old logs
 *     description: Deletes logs older than the specified retention period
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               days:
 *                 type: integer
 *                 description: Number of days to keep logs for (delete logs older than this)
 *                 default: 90
 *               level:
 *                 type: string
 *                 description: Only clear logs at this level or below (INFO=lowest, ERROR=highest)
 *                 enum: [INFO, WARN, ERROR]
 *     responses:
 *       200:
 *         description: Logs cleared successfully
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
 *                   example: Successfully cleared old logs
 *                 deletedCount:
 *                   type: integer
 *                   example: 247
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Server error
 */
router.post("/clear", async (req, res) => {
  try {
    const { days = 90, level } = req.body;

    if (days < 1) {
      return res.status(400).json({
        status: "error",
        message: "Retention period must be at least 1 day",
      });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const deletedCount = await logService.clearOldLogs(cutoffDate, level);

    res.json({
      status: "success",
      message: "Successfully cleared old logs",
      deletedCount,
    });
  } catch (error) {
    console.error("Error clearing logs:", error);
    res.status(500).json({ status: "error", message: "Failed to clear logs" });
  }
});

/**
 * @swagger
 * /logs/stats:
 *   get:
 *     summary: Get log statistics
 *     description: Retrieves statistics about system logs
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: days
 *         in: query
 *         schema:
 *           type: integer
 *           default: 30
 *           description: Number of days to include in the statistics
 *     responses:
 *       200:
 *         description: Log statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalLogs:
 *                       type: integer
 *                       example: 12500
 *                     logsByLevel:
 *                       type: object
 *                       properties:
 *                         INFO:
 *                           type: integer
 *                           example: 10200
 *                         WARN:
 *                           type: integer
 *                           example: 2100
 *                         ERROR:
 *                           type: integer
 *                           example: 200
 *                     topPaths:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           path:
 *                             type: string
 *                             example: /api/v1/users
 *                           count:
 *                             type: integer
 *                             example: 2500
 *       500:
 *         description: Server error
 */
export default router;
