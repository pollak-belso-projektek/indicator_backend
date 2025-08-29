import e from "express";
import {
  getAll,
  createMany,
} from "../services/alkalmazottak_munkaugy.service.js";

const router = e.Router();

/**
 * @swagger
 * tags:
 *   name: Alkalmazottak_Munkaugy
 *   description: Employee work data management
 *
 * components:
 *   schemas:
 *     AlkalmazottMunkaugy:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         alapadatok_id:
 *           type: string
 *           format: uuid
 *           description: School identifier reference
 *           example: "550e8400-e29b-41d4-a716-446655440001"
 *         Elotag:
 *           type: string
 *           description: Employee name prefix
 *           example: "Dr."
 *         Vezeteknev:
 *           type: string
 *           description: Employee last name
 *           example: "Nagy"
 *         Utonev:
 *           type: string
 *           description: Employee first name
 *           example: "János"
 *         AlkalmazottTeljesNeve:
 *           type: string
 *           description: Employee full name
 *           example: "Dr. Nagy János"
 *         PedagogusOkatatasiAzonosito:
 *           type: string
 *           description: Teacher educational identifier
 *           example: "PED123456"
 *         TanevKezdete:
 *           type: integer
 *           description: Start year of school term
 *           example: 2024
 *         PedagogusFokozat:
 *           type: string
 *           description: Teacher degree
 *           example: "Mesterfokozat"
 *         Munkakor:
 *           type: string
 *           description: Job position
 *           example: "Tanár"
 *         FoglalkoztatasiJogviszony:
 *           type: string
 *           description: Employment relationship type
 *           example: "Határozatlan idejű"
 *         KotelezoOraszama:
 *           type: integer
 *           description: Required weekly hours
 *           example: 22
 *         Oraszam:
 *           type: number
 *           format: decimal
 *           description: Weekly working hours
 *           example: 22.5
 *         AlkalmazasKezdete:
 *           type: string
 *           format: date
 *           description: Employment start date
 *         AlkalmazasVege:
 *           type: string
 *           format: date
 *           description: Employment end date
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *       required:
 *         - alapadatok_id
 */

/**
 * @swagger
 * /alkalmazottak_munkaugy/{alapadatok_id}/{tanev_kezdete}:
 *   get:
 *     summary: Get employee work data by school ID and school year
 *     description: Retrieve employee work data for a specific school and school year
 *     tags: [Alkalmazottak_Munkaugy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alapadatok_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School unique identifier
 *       - in: path
 *         name: tanev_kezdete
 *         required: true
 *         schema:
 *           type: integer
 *         description: Start year of school term
 *     responses:
 *       200:
 *         description: Success - Employee work data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AlkalmazottMunkaugy'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get("/:alapadatok_id/:tanev_kezdete", async (req, res) => {
  try {
    const { alapadatok_id, tanev_kezdete } = req.params;
    const result = await getAll(alapadatok_id, tanev_kezdete);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching alkalmazottak_munkaugy:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /alkalmazottak_munkaugy/{alapadatok_id}:
 *   get:
 *     summary: Get all employee work data by school ID
 *     description: Retrieve all employee work data for a specific school (all years)
 *     tags: [Alkalmazottak_Munkaugy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alapadatok_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School unique identifier
 *     responses:
 *       200:
 *         description: Success - Employee work data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AlkalmazottMunkaugy'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get("/:alapadatok_id", async (req, res) => {
  try {
    const { alapadatok_id } = req.params;
    const result = await getAll(alapadatok_id);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching alkalmazottak_munkaugy:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /alkalmazottak_munkaugy:
 *   post:
 *     summary: Create multiple employee work data records
 *     description: Add multiple employee work data entries for a school
 *     tags: [Alkalmazottak_Munkaugy]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - alapadatok_id
 *               - alkalmazottak_munkaugy
 *             properties:
 *               alapadatok_id:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440001"
 *                 description: School ID reference
 *               alkalmazottak_munkaugy:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     Elotag:
 *                       type: string
 *                       example: "Dr."
 *                     Vezeteknev:
 *                       type: string
 *                       example: "Nagy"
 *                     Utonev:
 *                       type: string
 *                       example: "János"
 *                     AlkalmazottTeljesNeve:
 *                       type: string
 *                       example: "Dr. Nagy János"
 *                     PedagogusOkatatasiAzonosito:
 *                       type: string
 *                       example: "PED123456"
 *                     TanevKezdete:
 *                       type: integer
 *                       example: 2024
 *                     PedagogusFokozat:
 *                       type: string
 *                       example: "Mesterfokozat"
 *                     Munkakor:
 *                       type: string
 *                       example: "Tanár"
 *                     FoglalkoztatasiJogviszony:
 *                       type: string
 *                       example: "Határozatlan idejű"
 *                     KotelezoOraszama:
 *                       type: integer
 *                       example: 22
 *                     Oraszam:
 *                       type: number
 *                       format: decimal
 *                       example: 22.5
 *                     AlkalmazasKezdete:
 *                       type: string
 *                       format: date
 *                       example: "2024-09-01"
 *                     AlkalmazasVege:
 *                       type: string
 *                       format: date
 *                       example: "2025-06-30"
 *     responses:
 *       201:
 *         description: Successfully created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Number of records created
 *                   example: 15
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.post("/", async (req, res) => {
  try {
    const { alapadatok_id, alkalmazottak_munkaugy } = req.body;

    const result = await createMany(alapadatok_id, alkalmazottak_munkaugy);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating alkalmazottak_munkaugy:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// /count/:alapadatok_id/:tanev_kezdete
router.get("/count/:alapadatok_id/:tanev_kezdete", async (req, res) => {
  try {
    const { alapadatok_id, tanev_kezdete } = req.params;
    const result = await getAll(alapadatok_id, tanev_kezdete);
    res.status(200).json({ count: result.length });
  } catch (error) {
    console.error("Error counting alkalmazottak_munkaugy:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
