import e from "express";
import {
  getAll,
  create,
  getById,
  update,
} from "../services/kompetencia.service.js";

const router = e.Router();

/**
 * @swagger
 * tags:
 *   name: Kompetencia
 *   description: School competency measurements management
 *
 * components:
 *   schemas:
 *     Kompetencia:
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
 *         tanev_kezdete:
 *           type: string
 *           description: School year start date
 *           example: "2024-09-01"
 *         mat_orsz_p:
 *           type: number
 *           format: float
 *           description: National mathematics percentage
 *           example: 78.5
 *         szoveg_orsz_p:
 *           type: number
 *           format: float
 *           description: National text comprehension percentage
 *           example: 82.3
 *         mat_int_p:
 *           type: number
 *           format: float
 *           description: Institution mathematics percentage
 *           example: 75.8
 *         szoveg_int_p:
 *           type: number
 *           format: float
 *           description: Institution text comprehension percentage
 *           example: 80.1
 *         kepzes_forma:
 *           type: string
 *           description: Type of education
 *           example: "Technikum"
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
 *         - tanev_kezdete
 *         - mat_orsz_p
 *         - szoveg_orsz_p
 *         - mat_int_p
 *         - szoveg_int_p
 *         - kepzes_forma
 */

/**
 * @swagger
 * /kompetencia:
 *   get:
 *     summary: Get all competency measurements
 *     description: Retrieve a list of all competency measurements for all schools
 *     tags: [Kompetencia]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success - List of competency data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Kompetencia'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */
router.get("/", async (req, res) => {
  const data = await getAll();

  res.status(200).json(data);
});

/**
 * @swagger
 * /kompetencia/{alapadatok_id}:
 *   get:
 *     summary: Get competency data by school ID
 *     description: Retrieve competency measurements for a specific school
 *     tags: [Kompetencia]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alapadatok_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: School unique identifier
 *     responses:
 *       200:
 *         description: Success - School competency data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Kompetencia'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */
router.get("/:alapadatok_id", async (req, res) => {
  const data = await getById(req.params.alapadatok_id);

  res.status(200).json(data);
});

/**
 * @swagger
 * /kompetencia:
 *   post:
 *     summary: Create new competency record
 *     description: Add a new competency measurement for a school
 *     tags: [Kompetencia]
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
 *               - tanev_kezdete
 *               - mat_orsz_p
 *               - szoveg_orsz_p
 *               - mat_int_p
 *               - szoveg_int_p
 *               - kepzes_forma
 *             properties:
 *               alapadatok_id:
 *                 type: integer
 *                 example: 1
 *               tanev_kezdete:
 *                 type: string
 *                 example: "2024-09-01"
 *               mat_orsz_p:
 *                 type: number
 *                 format: float
 *                 example: 78.5
 *               szoveg_orsz_p:
 *                 type: number
 *                 format: float
 *                 example: 82.3
 *               mat_int_p:
 *                 type: number
 *                 format: float
 *                 example: 75.8
 *               szoveg_int_p:
 *                 type: number
 *                 format: float
 *                 example: 80.1
 *               kepzes_forma:
 *                 type: string
 *                 example: "Technikum"
 *     responses:
 *       201:
 *         description: Successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Kompetencia'
 *       400:
 *         description: Invalid data
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */
router.post("/", async (req, res) => {
  try {
    const {
      alapadatok_id,
      tanev_kezdete,
      mat_orsz_p,
      szoveg_orsz_p,
      mat_int_p,
      szoveg_int_p,
      kepzes_forma,
    } = req.body;

    const data = await create(
      alapadatok_id,
      tanev_kezdete,
      mat_orsz_p,
      szoveg_orsz_p,
      mat_int_p,
      szoveg_int_p,
      kepzes_forma
    );

    res.status(201).json(data);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

router.put("/", async (req, res) => {
  try {
    const {
      id,
      alapadatok_id,
      tanev_kezdete,
      mat_orsz_p,
      szoveg_orsz_p,
      mat_int_p,
      szoveg_int_p,
      kepzes_forma,
    } = req.body;

    if (!id || !alapadatok_id) {
      return res
        .status(400)
        .json({ message: "Missing required fields: id or alapadatok_id" });
    }

    const data = await update(
      id,
      alapadatok_id,
      tanev_kezdete,
      mat_orsz_p,
      szoveg_orsz_p,
      mat_int_p,
      szoveg_int_p,
      kepzes_forma
    );

    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json(error);
  }
});

export default router;
