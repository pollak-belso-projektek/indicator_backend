import e from "express";
import {
  getAll,
  getById,
  create,
  update,
  updateAlias,
  lock,
  unlock,
  isTableLocked,
} from "../services/tablelist.service.js";
import { logRequest } from "../services/log.service.js";

const router = e.Router();

// Helper function for logging lock/unlock and alias operations
async function logTableOperation(
  req,
  operation,
  tableId,
  tableName,
  details = {}
) {
  try {
    const userId = req.user?.id || req.user?.sub || "unknown";
    const logMessage = `Table ${operation}: ${tableName || tableId}`;

    await logRequest({
      userId,
      method: "POST",
      url: req.originalUrl,
      statusCode: 200,
      responseTime: 0,
      requestBody: JSON.stringify({
        operation,
        tableName,
        tableId,
        ...details,
      }),
      level: "info",
      message: logMessage,
    });

    console.log(`[TableList] ${logMessage} by user ${userId}`);
  } catch (error) {
    console.error("Failed to log table operation:", error);
  }
}

/**
 * @swagger
 * tags:
 *   name: TableList
 *   description: Table list management endpoints for managing available data tables
 *
 * components:
 *   schemas:
 *     TableList:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the table
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         name:
 *           type: string
 *           maxLength: 100
 *           description: Name of the table
 *           example: "tanugyi_adatok"
 *         alias:
 *           type: string
 *           maxLength: 100
 *           nullable: true
 *           description: Display name/alias for the table
 *           example: "Tanügyi adatok"
 *         isAvailable:
 *           type: boolean
 *           description: Whether the table is available for access
 *           example: true
 *         isLocked:
 *           type: boolean
 *           description: Whether the table is locked for modifications
 *           example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the table entry was created
 *           example: "2024-01-01T00:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the table entry was last updated
 *           example: "2024-01-02T12:30:00.000Z"
 *     TableListInput:
 *       type: object
 *       required:
 *         - name
 *         - isAvailable
 *       properties:
 *         name:
 *           type: string
 *           maxLength: 100
 *           description: Name of the table
 *           example: "tanugyi_adatok"
 *         isAvailable:
 *           type: boolean
 *           description: Whether the table should be available for access
 *           example: true
 *     TableListError:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *           example: "Invalid table data."
 */

/**
 * @swagger
 * /tablelist:
 *   get:
 *     summary: Get all tables
 *     description: Retrieves a list of all available tables in the system
 *     tags: [TableList]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tables retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TableList'
 *             example:
 *               - id: "123e4567-e89b-12d3-a456-426614174000"
 *                 name: "tanugyi_adatok"
 *                 isAvailable: true
 *                 createdAt: "2024-01-01T00:00:00.000Z"
 *                 updatedAt: "2024-01-02T12:30:00.000Z"
 *               - id: "987fcdeb-51d2-4567-8901-123456789abc"
 *                 name: "tanulo_letszam"
 *                 isAvailable: false
 *                 createdAt: "2024-01-01T00:00:00.000Z"
 *                 updatedAt: null
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TableListError'
 *             example:
 *               error: "Unauthorized: Invalid or expired token"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TableListError'
 *             example:
 *               error: "Internal server error"
 */
router.get("/", async (req, res) => {
  const data = await getAll();

  res.status(200).json(data);
});

/**
 * @swagger
 * /tablelist:
 *   post:
 *     summary: Create a new table
 *     description: Creates a new table entry in the system
 *     tags: [TableList]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableListInput'
 *           example:
 *             name: "new_table"
 *             isAvailable: true
 *     responses:
 *       201:
 *         description: Table created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TableList'
 *             example:
 *               id: "123e4567-e89b-12d3-a456-426614174000"
 *               name: "new_table"
 *               isAvailable: true
 *               createdAt: "2024-01-01T00:00:00.000Z"
 *               updatedAt: null
 *       400:
 *         description: Bad request - Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TableListError'
 *             example:
 *               error: "Invalid table data."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TableListError'
 *             example:
 *               error: "Unauthorized: Invalid or expired token"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TableListError'
 *             example:
 *               error: "Failed to create table."
 */
router.post("/", async (req, res) => {
  const { name, isAvailable } = req.body;

  if (!name || typeof isAvailable !== "boolean") {
    return res.status(400).json({ error: "Invalid table data." });
  }

  try {
    const newTable = await create(name, isAvailable);
    res.status(201).json(newTable);
  } catch (error) {
    console.error("Error creating table:", error);
    res.status(500).json({ error: "Failed to create table." });
  }
});

/**
 * @swagger
 * /tablelist/{id}:
 *   put:
 *     summary: Update an existing table
 *     description: Updates an existing table entry in the system
 *     tags: [TableList]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Unique identifier of the table to update
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TableListInput'
 *           example:
 *             name: "updated_table"
 *             isAvailable: false
 *     responses:
 *       200:
 *         description: Table updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TableList'
 *             example:
 *               id: "123e4567-e89b-12d3-a456-426614174000"
 *               name: "updated_table"
 *               isAvailable: false
 *               createdAt: "2024-01-01T00:00:00.000Z"
 *               updatedAt: "2024-01-02T12:30:00.000Z"
 *       400:
 *         description: Bad request - Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TableListError'
 *             example:
 *               error: "Invalid table data."
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TableListError'
 *             example:
 *               error: "Unauthorized: Invalid or expired token"
 *       404:
 *         description: Table not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TableListError'
 *             example:
 *               error: "Table not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TableListError'
 *             example:
 *               error: "Failed to update table."
 */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, isAvailable } = req.body;
  if (!name || typeof isAvailable !== "boolean") {
    return res.status(400).json({ error: "Invalid table data." });
  }

  try {
    // Check if table is locked
    const locked = await isTableLocked(id);
    if (locked) {
      return res
        .status(403)
        .json({ error: "Table is locked and cannot be modified." });
    }

    const updatedTable = await update(id, name, isAvailable);
    res.status(200).json(updatedTable);
  } catch (error) {
    console.error("Error updating table:", error);
    res.status(500).json({ error: "Failed to update table." });
  }
});

/**
 * @swagger
 * /tablelist/{id}/lock:
 *   post:
 *     summary: Lock a table
 *     description: Locks a table to prevent modifications
 *     tags: [TableList]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Unique identifier of the table to lock
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Table locked successfully
 *       404:
 *         description: Table not found
 *       500:
 *         description: Internal server error
 */
router.post("/:id/lock", async (req, res) => {
  const { id } = req.params;

  try {
    const table = await getById(id);
    if (!table) {
      return res.status(404).json({ error: "Table not found." });
    }

    const lockedTable = await lock(id);

    // Log the lock operation
    await logTableOperation(req, "LOCK", id, table.name);

    res.status(200).json(lockedTable);
  } catch (error) {
    console.error("Error locking table:", error);
    res.status(500).json({ error: "Failed to lock table." });
  }
});

/**
 * @swagger
 * /tablelist/{id}/unlock:
 *   post:
 *     summary: Unlock a table
 *     description: Unlocks a table to allow modifications
 *     tags: [TableList]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Unique identifier of the table to unlock
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Table unlocked successfully
 *       404:
 *         description: Table not found
 *       500:
 *         description: Internal server error
 */
router.post("/:id/unlock", async (req, res) => {
  const { id } = req.params;

  try {
    const table = await getById(id);
    if (!table) {
      return res.status(404).json({ error: "Table not found." });
    }

    const unlockedTable = await unlock(id);

    // Log the unlock operation
    await logTableOperation(req, "UNLOCK", id, table.name);

    res.status(200).json(unlockedTable);
  } catch (error) {
    console.error("Error unlocking table:", error);
    res.status(500).json({ error: "Failed to unlock table." });
  }
});

/**
 * @swagger
 * /tablelist/{id}/alias:
 *   put:
 *     summary: Update table alias
 *     description: Updates the alias (display name) of a table
 *     tags: [TableList]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Unique identifier of the table
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               alias:
 *                 type: string
 *                 maxLength: 100
 *                 description: New alias for the table
 *     responses:
 *       200:
 *         description: Alias updated successfully
 *       400:
 *         description: Invalid alias data
 *       403:
 *         description: Table is locked
 *       404:
 *         description: Table not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id/alias", async (req, res) => {
  const { id } = req.params;
  const { alias } = req.body;

  if (alias !== null && typeof alias !== "string") {
    return res.status(400).json({ error: "Invalid alias data." });
  }

  try {
    const table = await getById(id);
    if (!table) {
      return res.status(404).json({ error: "Table not found." });
    }

    // Check if table is locked
    if (table.isLocked) {
      return res
        .status(403)
        .json({ error: "Table is locked and cannot be modified." });
    }

    const oldAlias = table.alias;
    const updatedTable = await updateAlias(id, alias);

    // Log the alias change operation
    await logTableOperation(req, "ALIAS_CHANGE", id, table.name, {
      oldAlias,
      newAlias: alias,
    });

    res.status(200).json(updatedTable);
  } catch (error) {
    console.error("Error updating table alias:", error);
    res.status(500).json({ error: "Failed to update table alias." });
  }
});

export default router;
