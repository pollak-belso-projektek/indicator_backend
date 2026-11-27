import e from "express";
import { getAll, create, update, remove } from "../services/changelog.service.js";

const router = e.Router();

/**
 * @swagger
 * tags:
 *   name: Changelog
 *   description: System changelog management
 *
 * components:
 *   schemas:
 *     Changelog:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         version:
 *           type: string
 *         date:
 *           type: string
 *           format: date
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /changelog:
 *   get:
 *     summary: Get all changelog entries
 *     tags: [Changelog]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of changelog entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Changelog'
 */
router.get("/", async (req, res) => {
    try {
        const changes = await getAll();
        res.json(changes);
    } catch (error) {
        console.error("Error fetching changelog:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @swagger
 * /changelog:
 *   post:
 *     summary: Create a new changelog entry
 *     tags: [Changelog]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - date
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               version:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Created changelog entry
 *       403:
 *         description: Forbidden - Superadmin only
 */
router.post("/", async (req, res) => {
    try {
        // Check for superadmin permission
        if (!req.user?.permissionsDetails?.isSuperadmin) {
            return res.status(403).json({ error: "Forbidden: Superadmin access required" });
        }

        const entry = await create(req.body);
        res.status(201).json(entry);
    } catch (error) {
        console.error("Error creating changelog entry:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @swagger
 * /changelog/{id}:
 *   put:
 *     summary: Update a changelog entry
 *     tags: [Changelog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               version:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Updated changelog entry
 *       403:
 *         description: Forbidden - Superadmin only
 */
router.put("/:id", async (req, res) => {
    try {
        // Check for superadmin permission
        if (!req.user?.permissionsDetails?.isSuperadmin) {
            return res.status(403).json({ error: "Forbidden: Superadmin access required" });
        }

        const entry = await update(req.params.id, req.body);
        res.json(entry);
    } catch (error) {
        console.error("Error updating changelog entry:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @swagger
 * /changelog/{id}:
 *   delete:
 *     summary: Delete a changelog entry
 *     tags: [Changelog]
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
 *         description: Deleted successfully
 *       403:
 *         description: Forbidden - Superadmin only
 */
router.delete("/:id", async (req, res) => {
    try {
        // Check for superadmin permission
        if (!req.user?.permissionsDetails?.isSuperadmin) {
            return res.status(403).json({ error: "Forbidden: Superadmin access required" });
        }

        await remove(req.params.id);
        res.json({ message: "Deleted successfully" });
    } catch (error) {
        console.error("Error deleting changelog entry:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
