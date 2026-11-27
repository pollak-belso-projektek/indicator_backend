import express from "express";
import { getHistory, getHistoryById, rollback } from "../services/form_history.service.js";
import { tablesForSnapshot, userHasTableAccess } from "../utils/tableAccessMap.js";

const router = express.Router();

/**
 * @swagger
 * /form_history/{alapadatok_id}/{table_name}:
 *   get:
 *     summary: Get history snapshots for a specific table and alapadatok
 *     tags: [FormHistory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alapadatok_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: table_name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of history snapshots
 */
router.get("/:alapadatok_id/:table_name", async (req, res) => {
  try {
    const { alapadatok_id, table_name } = req.params;
    const history = await getHistory(alapadatok_id, table_name);
    res.status(200).json(history);
  } catch (error) {
    console.error("Error fetching form history:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /form_history/rollback/{id}:
 *   post:
 *     summary: Rollback to a specific history snapshot
 *     tags: [FormHistory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Successfully rolled back
 */
router.post("/rollback/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Restoring overwrites the table's current data: requires the update right on
    // the table the snapshot belongs to (developers bypass table rights).
    const history = await getHistoryById(id);
    if (!history) {
      return res.status(404).json({ error: "A mentési pont nem található." });
    }
    const isDeveloper = req.user?.permissionsDetails?.isSuperadmin;
    if (!isDeveloper && !userHasTableAccess(req.user, tablesForSnapshot(history.table_name), "PUT")) {
      return res.status(403).json({ error: "Nincs jogosultságod a visszaállításhoz." });
    }
    const result = await rollback(id);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error rolling back:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

export default router;
