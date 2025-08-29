import {
  getAll,
  getById,
  create,
  deleteMany,
  update,
} from "../services/tanulo_letszam.service.js";
import e from "express";

const router = e.Router();

/**
 * @swagger
 * tags:
 *   name: Tanulo_letszam
 *   description: Student enrollment data management
 *
 * components:
 *   schemas:
 *     TanuloLetszam:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier
 *           example: 1
 *         alapadatok_id:
 *           type: integer
 *           description: School identifier reference
 *           example: 1
 *         jogv_tipus:
 *           type: integer
 *           description: Type of legal relationship
 *           example: 1
 *         szakirany:
 *           type: string
 *           description: Specialization area
 *           example: "Informatika"
 *         tanev_kezdete:
 *           type: integer
 *           description: School year start
 *           example: 2024
 *         letszam:
 *           type: integer
 *           description: Number of students
 *           example: 120
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
 *         - jogv_tipus
 *         - szakirany
 *         - tanev_kezdete
 *         - letszam
 */

/**
 * @swagger
 * /tanulo_letszam:
 *   get:
 *     summary: Get all student enrollment data
 *     description: Retrieve student numbers for all schools
 *     tags: [Tanulo_letszam]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success - List of student enrollment data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TanuloLetszam'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal Server Error
 */
router.get("/", async (req, res) => {
  try {
    const data = await getAll();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /tanulo_letszam/{id}:
 *   get:
 *     summary: Get student enrollment data by school ID
 *     description: Retrieve student numbers for a specific school
 *     tags: [Tanulo_letszam]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: School unique identifier
 *     responses:
 *       200:
 *         description: Success - School student enrollment data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TanuloLetszam'
 *       404:
 *         description: Data not found
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal Server Error
 */
router.get("/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const data = await getById(id);
    if (data.length === 0) {
      return res.status(404).json({ error: "Data not found" });
    }
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /tanulo_letszam:
 *   post:
 *     summary: Create new student enrollment record
 *     description: Add a new student enrollment record for a school
 *     tags: [Tanulo_letszam]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - letszam
 *               - alapadatok_id
 *               - jogv_tipus
 *               - szakirany
 *               - tanev_kezdete
 *             properties:
 *               letszam:
 *                 type: integer
 *                 example: 120
 *                 description: Number of students
 *               alapadatok_id:
 *                 type: integer
 *                 example: 1
 *                 description: School ID reference
 *               jogv_tipus:
 *                 type: integer
 *                 example: 1
 *                 description: Type of legal relationship
 *               szakirany:
 *                 type: string
 *                 example: "Informatika"
 *                 description: Specialization area
 *               tanev_kezdete:
 *                 type: integer
 *                 example: 2024
 *                 description: School year start
 *     responses:
 *       201:
 *         description: Successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TanuloLetszam'
 *       400:
 *         description: All fields are required
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal Server Error
 */
router.post("/", async (req, res) => {
  const {
    letszam,
    alapadatok_id,
    jogv_tipus,
    szakirany,
    szakma,
    tanev_kezdete,
  } = req.body;

  if (
    isNaN(letszam) ||
    !alapadatok_id ||
    isNaN(jogv_tipus) ||
    !szakirany ||
    isNaN(tanev_kezdete)
  ) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const newEntry = await create(
      letszam,
      alapadatok_id,
      jogv_tipus,
      szakirany,
      szakma,
      tanev_kezdete
    );
    res.status(201).json(newEntry);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  const id = req.params.id;
  const {
    letszam,
    alapadatok_id,
    jogv_tipus,
    szakirany,
    szakma,
    tanev_kezdete,
  } = req.body;

  if (
    isNaN(letszam) ||
    !alapadatok_id ||
    isNaN(jogv_tipus) ||
    !szakirany ||
    isNaN(tanev_kezdete)
  ) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const updatedEntry = await update(
      id,
      letszam,
      alapadatok_id,
      jogv_tipus,
      szakirany,
      szakma,
      tanev_kezdete
    );
    res.status(200).json(updatedEntry);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /tanulo_letszam/{id}/{year}:
 *   delete:
 *     summary: Delete student enrollment records
 *     description: Delete all student enrollment records for a specific school and year
 *     tags: [Tanulo_letszam]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: School unique identifier
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         description: Academic year
 *     responses:
 *       200:
 *         description: Data deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Data deleted successfully"
 *       400:
 *         description: Invalid ID or year format
 *       404:
 *         description: Data not found
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal Server Error
 */
router.delete("/:id/:year", async (req, res) => {
  const id = req.params.id;
  const year = parseInt(req.params.year);

  if (!id || isNaN(year)) {
    return res.status(400).json({ error: "Invalid ID or year format" });
  }

  try {
    const result = await deleteMany(id, year);
    if (result.count === 0) {
      return res.status(404).json({ error: "Data not found" });
    }
    res.status(200).json({ message: "Data deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});
export default router;
