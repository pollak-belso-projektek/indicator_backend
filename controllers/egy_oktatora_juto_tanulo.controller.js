import e from "express";
import {
  getAll,
  getById,
  create,
  update,
} from "../services/egy_oktatora_juto_tanulo.service.js";

const router = e.Router();

/**
 * @swagger
 * tags:
 *   name: EgyOktatoraJutoTanulo
 *   description: Student-to-teacher ratio data management endpoints
 *
 * components:
 *   schemas:
 *     EgyOktatoraJutoTanulo:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the record
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         alapadatok_id:
 *           type: string
 *           format: uuid
 *           description: Reference to the school's basic data
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         tanev_kezdete:
 *           type: integer
 *           minimum: 1900
 *           maximum: 2100
 *           description: Academic year start (e.g., 2024 for 2024/2025 academic year)
 *           example: 2024
 *         letszam:
 *           type: integer
 *           minimum: 0
 *           description: Number of students per teacher
 *           example: 25
 *         createAt:
 *           type: string
 *           format: date-time
 *           description: When the record was created
 *           example: "2024-01-01T00:00:00.000Z"
 *         createBy:
 *           type: string
 *           nullable: true
 *           description: Who created the record
 *           example: "user@example.com"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the record was last updated
 *           example: "2024-01-02T12:30:00.000Z"
 *         updatedBy:
 *           type: string
 *           nullable: true
 *           description: Who last updated the record
 *           example: "admin@example.com"
 *         alapadatok:
 *           $ref: '#/components/schemas/Alapadatok'
 *           description: Related school basic information
 *     EgyOktatoraJutoTanuloInput:
 *       type: object
 *       required:
 *         - tanev_kezdete
 *         - letszam
 *         - alapadatok_id
 *       properties:
 *         tanev_kezdete:
 *           type: integer
 *           minimum: 1900
 *           maximum: 2100
 *           description: Academic year start (e.g., 2024 for 2024/2025 academic year)
 *           example: 2024
 *         letszam:
 *           type: integer
 *           minimum: 0
 *           description: Number of students per teacher
 *           example: 25
 *         alapadatok_id:
 *           type: string
 *           format: uuid
 *           description: Reference to the school's basic data
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *     EgyOktatoraJutoTanuloError:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *           example: "Missing required fields"
 */

/**
 * @swagger
 * /egy_oktatora_juto_tanulo:
 *   get:
 *     summary: Get all student-to-teacher ratio records
 *     description: Retrieves a list of all student-to-teacher ratio data for all schools
 *     tags: [EgyOktatoraJutoTanulo]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of student-to-teacher ratio records retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EgyOktatoraJutoTanulo'
 *             example:
 *               - id: "123e4567-e89b-12d3-a456-426614174000"
 *                 alapadatok_id: "987fcdeb-51d2-4567-8901-123456789abc"
 *                 tanev_kezdete: 2024
 *                 letszam: 25
 *                 createAt: "2024-01-01T00:00:00.000Z"
 *                 createBy: "admin@example.com"
 *                 updatedAt: "2024-01-02T12:30:00.000Z"
 *                 updatedBy: "admin@example.com"
 *               - id: "456e7890-f12a-34b5-c678-901234567def"
 *                 alapadatok_id: "321fcdeb-51d2-4567-8901-987654321cba"
 *                 tanev_kezdete: 2023
 *                 letszam: 28
 *                 createAt: "2023-09-01T00:00:00.000Z"
 *                 createBy: "user@example.com"
 *                 updatedAt: null
 *                 updatedBy: null
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EgyOktatoraJutoTanuloError'
 *             example:
 *               error: "Unauthorized: Invalid or expired token"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EgyOktatoraJutoTanuloError'
 *             example:
 *               error: "Internal Server Error"
 */

router.get("/", async (req, res) => {
  try {
    const data = await getAll();
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /egy_oktatora_juto_tanulo/{alapadatok_id}:
 *   get:
 *     summary: Get student-to-teacher ratio records by school ID
 *     description: Retrieves student-to-teacher ratio data for a specific school
 *     tags: [EgyOktatoraJutoTanulo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alapadatok_id
 *         required: true
 *         description: Unique identifier of the school (alapadatok)
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Student-to-teacher ratio records for the specified school
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EgyOktatoraJutoTanulo'
 *             example:
 *               - id: "123e4567-e89b-12d3-a456-426614174000"
 *                 alapadatok_id: "123e4567-e89b-12d3-a456-426614174000"
 *                 tanev_kezdete: 2024
 *                 letszam: 25
 *                 createAt: "2024-01-01T00:00:00.000Z"
 *                 createBy: "admin@example.com"
 *                 updatedAt: "2024-01-02T12:30:00.000Z"
 *                 updatedBy: "admin@example.com"
 *               - id: "456e7890-f12a-34b5-c678-901234567def"
 *                 alapadatok_id: "123e4567-e89b-12d3-a456-426614174000"
 *                 tanev_kezdete: 2023
 *                 letszam: 28
 *                 createAt: "2023-09-01T00:00:00.000Z"
 *                 createBy: "user@example.com"
 *                 updatedAt: null
 *                 updatedBy: null
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EgyOktatoraJutoTanuloError'
 *             example:
 *               error: "Unauthorized: Invalid or expired token"
 *       404:
 *         description: No data found for the specified school
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EgyOktatoraJutoTanuloError'
 *             example:
 *               error: "Data not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EgyOktatoraJutoTanuloError'
 *             example:
 *               error: "Internal Server Error"
 */
router.get("/:alapadatok_id/:year", async (req, res) => {
  const alapadatok_id = req.params.alapadatok_id;
  const year = req.params.year;

  try {
    const data = await getById(alapadatok_id, year);
    if (data.length === 0) {
      return res.status(404).json({ error: "Data not found" });
    }
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching data by ID:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /egy_oktatora_juto_tanulo:
 *   post:
 *     summary: Create a new student-to-teacher ratio record
 *     description: Creates a new student-to-teacher ratio data entry for a school
 *     tags: [EgyOktatoraJutoTanulo]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EgyOktatoraJutoTanuloInput'
 *           example:
 *             tanev_kezdete: 2024
 *             letszam: 25
 *             alapadatok_id: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       201:
 *         description: Student-to-teacher ratio record created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EgyOktatoraJutoTanulo'
 *             example:
 *               id: "123e4567-e89b-12d3-a456-426614174000"
 *               alapadatok_id: "123e4567-e89b-12d3-a456-426614174000"
 *               tanev_kezdete: 2024
 *               letszam: 25
 *               createAt: "2024-01-01T00:00:00.000Z"
 *               createBy: null
 *               updatedAt: null
 *               updatedBy: null
 *       400:
 *         description: Bad request - Missing required fields or invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EgyOktatoraJutoTanuloError'
 *             example:
 *               error: "Missing required fields"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EgyOktatoraJutoTanuloError'
 *             example:
 *               error: "Unauthorized: Invalid or expired token"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EgyOktatoraJutoTanuloError'
 *             example:
 *               error: "Internal Server Error"
 */
router.post("/", async (req, res) => {
  const { tanev_kezdete, letszam, alapadatok_id } = req.body;

  if (!tanev_kezdete || !letszam || !alapadatok_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const newEntry = await create(tanev_kezdete, letszam, alapadatok_id);
    res.status(201).json(newEntry);
  } catch (error) {
    console.error("Error creating entry:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /egy_oktatora_juto_tanulo/{id}:
 *   put:
 *     summary: Update an existing student-to-teacher ratio record
 *     description: Updates an existing student-to-teacher ratio data entry
 *     tags: [EgyOktatoraJutoTanulo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Unique identifier of the record to update
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EgyOktatoraJutoTanuloInput'
 *           example:
 *             tanev_kezdete: 2024
 *             letszam: 30
 *             alapadatok_id: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Student-to-teacher ratio record updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EgyOktatoraJutoTanulo'
 *             example:
 *               id: "123e4567-e89b-12d3-a456-426614174000"
 *               alapadatok_id: "123e4567-e89b-12d3-a456-426614174000"
 *               tanev_kezdete: 2024
 *               letszam: 30
 *               createAt: "2024-01-01T00:00:00.000Z"
 *               createBy: "admin@example.com"
 *               updatedAt: "2024-01-02T15:45:00.000Z"
 *               updatedBy: "admin@example.com"
 *       400:
 *         description: Bad request - Missing required fields or invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EgyOktatoraJutoTanuloError'
 *             example:
 *               error: "Missing required fields"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EgyOktatoraJutoTanuloError'
 *             example:
 *               error: "Unauthorized: Invalid or expired token"
 *       404:
 *         description: Record not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EgyOktatoraJutoTanuloError'
 *             example:
 *               error: "Record not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EgyOktatoraJutoTanuloError'
 *             example:
 *               error: "Internal Server Error"
 */
router.put("/:id", async (req, res) => {
  const id = req.params.id;
  const { tanev_kezdete, letszam, alapadatok_id } = req.body;

  if (!tanev_kezdete || !letszam || !alapadatok_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const updatedEntry = await update(
      id,
      tanev_kezdete,
      letszam,
      alapadatok_id
    );
    res.status(200).json(updatedEntry);
  } catch (error) {
    console.error("Error updating entry:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
