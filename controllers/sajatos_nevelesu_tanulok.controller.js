import e from "express";
import {
  getAll,
  getAllByAlapadatok,
  create,
  deleteAllByAlapadatok,
  update,
} from "../services/sajatos_nevelesu_tanulok.service.js";

const router = e.Router();

/**
 * @swagger
 * tags:
 *   name: Sajatos_nevelesu_tanulok
 *   description: Students with special needs data management
 *
 * components:
 *   schemas:
 *     SajatosNeveluTanulok:
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
 *           type: integer
 *           description: School year start year
 *           example: 2023
 *         sajatos_nevelesu_tanulok_szama:
 *           type: integer
 *           description: Number of students with special needs
 *           example: 18
 *         integralt_oktatas_tanulok_szama:
 *           type: integer
 *           description: Number of students in integrated education
 *           example: 12
 *         kulonleges_gondozas_tanulok_szama:
 *           type: integer
 *           description: Number of students receiving special care
 *           example: 6
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
 */

/**
 * @swagger
 * /sajatos_nevelesu_tanulok/{tanev}:
 *   get:
 *     summary: Get special needs students data by school year
 *     description: Retrieve special needs students data for a specific school year and previous 4 years
 *     tags: [Sajatos_nevelesu_tanulok]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tanev
 *         required: true
 *         description: The school year end (e.g., 2024 for 2023-2024 school year)
 *         schema:
 *           type: integer
 *           example: 2024
 *     responses:
 *       200:
 *         description: Special needs students data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SajatosNeveluTanulok'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */
router.get("/:tanev", async (req, res) => {
  try {
    const tanev = req.params.tanev;
    const data = await getAll(tanev);

    return res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching sajatos nevelesu tanulok data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /sajatos_nevelesu_tanulok/{alapadatokId}/{tanev}:
 *   get:
 *     summary: Get special needs students data by school and year
 *     description: Retrieve special needs students data for a specific school and year
 *     tags: [Sajatos_nevelesu_tanulok]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alapadatokId
 *         required: true
 *         description: Basic data ID reference
 *         schema:
 *           type: string
 *           example: "60d5ecb74f0b2c1234567890"
 *       - in: path
 *         name: tanev
 *         required: true
 *         description: The school year start (e.g., 2023 for 2023-2024 school year)
 *         schema:
 *           type: integer
 *           example: 2023
 *     responses:
 *       200:
 *         description: Special needs students data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SajatosNeveluTanulok'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete special needs students data by school and year
 *     description: Delete all special needs students data for a specific school and school year
 *     tags: [Sajatos_nevelesu_tanulok]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alapadatokId
 *         required: true
 *         description: Basic data ID reference
 *         schema:
 *           type: string
 *           example: "60d5ecb74f0b2c1234567890"
 *       - in: path
 *         name: tanev
 *         required: true
 *         description: The school year start (e.g., 2023 for 2023-2024 school year)
 *         schema:
 *           type: integer
 *           example: 2023
 *     responses:
 *       204:
 *         description: Special needs students data deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */
router.get("/:alapadatokId/:tanev", async (req, res) => {
  try {
    const alapadatokId = req.params.alapadatokId;
    const tanev = req.params.tanev;
    const data = await getAllByAlapadatok(alapadatokId, tanev);

    return res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching sajatos nevelesu tanulok data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /sajatos_nevelesu_tanulok:
 *   post:
 *     summary: Create special needs students data
 *     tags: [Sajatos_nevelesu_tanulok]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               alapadatok_id:
 *                 type: string
 *                 description: Basic data ID reference
 *                 example: "60d5ecb74f0b2c1234567890"
 *               tanev_kezdete:
 *                 type: string
 *                 description: Academic year start
 *                 example: "2023"
 *               sni_tanulok_szama:
 *                 type: integer
 *                 description: Number of students with special educational needs
 *                 example: 18
 *               tanulok_osszesen:
 *                 type: integer
 *                 description: Total number of students
 *                 example: 250
 *               osszes_tanulo_szama:
 *                 type: integer
 *                 description: Total number of students (alternative field name)
 *                 example: 250
 *             required:
 *               - alapadatok_id
 *               - tanev_kezdete
 *     responses:
 *       201:
 *         description: Special needs students data created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SajatosNeveluTanulok'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       400:
 *         description: Bad request - Invalid input data
 *       500:
 *         description: Internal server error
 */
router.post("/", async (req, res) => {
  try {
    const {
      alapadatok_id,
      tanev_kezdete,
      sni_tanulok_szama,
      tanulok_osszesen,
      osszes_tanulo_szama, // Alternative field name from client
    } = req.body;

    // Validate required fields
    if (!alapadatok_id) {
      return res.status(400).json({ error: "alapadatok_id is required" });
    }
    if (!tanev_kezdete) {
      return res.status(400).json({ error: "tanev_kezdete is required" });
    }

    // Handle different field names from client
    const rawTotal =
      tanulok_osszesen !== undefined ? tanulok_osszesen : osszes_tanulo_szama;

    if (rawTotal === undefined || rawTotal === null || rawTotal === "") {
      return res.status(400).json({
        error:
          "Total number of students is required (tanulok_osszesen or osszes_tanulo_szama)",
      });
    }

    const totalStudents = Number(rawTotal);

    const createdData = await create(
      alapadatok_id,
      tanev_kezdete,
      sni_tanulok_szama,
      totalStudents
    );

    return res.status(201).json(createdData);
  } catch (error) {
    console.error("Error creating sajatos nevelesu tanulok data:", error);

    // Return more specific error messages for validation errors
    if (
      error.message.includes("required") ||
      error.message.includes("must be")
    ) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /sajatos_nevelesi_tanulok/{id}:
 *   put:
 *     summary: Update special needs students data
 *     description: Update existing special needs students data record by ID
 *     tags: [Sajatos_nevelesu_tanulok]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Record ID to update
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               alapadatok_id:
 *                 type: string
 *                 description: Basic data ID reference
 *                 example: "60d5ecb74f0b2c1234567890"
 *               tanev_kezdete:
 *                 type: string
 *                 description: Academic year start
 *                 example: "2023"
 *               sni_tanulok_szama:
 *                 type: integer
 *                 description: Number of students with special educational needs
 *                 example: 18
 *               tanulok_osszesen:
 *                 type: integer
 *                 description: Total number of students
 *                 example: 250
 *             required:
 *               - alapadatok_id
 *               - tanev_kezdete
 *     responses:
 *       200:
 *         description: Special needs students data updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SajatosNeveluTanulok'
 *       400:
 *         description: Bad request - Invalid input data
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       404:
 *         description: Record not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const {
      alapadatok_id,
      tanev_kezdete,
      sni_tanulok_szama,
      tanulok_osszesen,
      osszes_tanulo_szama, // Alternative field name from client
    } = req.body;

    // Handle different field names from client
    const rawTotal =
      tanulok_osszesen !== undefined ? tanulok_osszesen : osszes_tanulo_szama;
    const totalStudents =
      rawTotal !== undefined && rawTotal !== null && rawTotal !== ""
        ? Number(rawTotal)
        : 0;

    const updatedData = await update(
      id,
      alapadatok_id,
      tanev_kezdete,
      sni_tanulok_szama,
      totalStudents
    );

    return res.status(200).json(updatedData);
  } catch (error) {
    console.error("Error updating sajatos nevelesu tanulok data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /sajatos_nevelesi_tanulok/{alapadatokId}/{tanev}:
 *   delete:
 *     summary: Delete special needs students data by school and year
 *     description: Delete all special needs students data for a specific school and school year
 *     tags: [Sajatos_nevelesu_tanulok]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alapadatokId
 *         required: true
 *         description: Basic data ID reference
 *         schema:
 *           type: string
 *           example: "60d5ecb74f0b2c1234567890"
 *       - in: path
 *         name: tanev
 *         required: true
 *         description: The school year start (e.g., 2023 for 2023-2024 school year)
 *         schema:
 *           type: integer
 *           example: 2023
 *     responses:
 *       204:
 *         description: Special needs students data deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Record not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:alapadatokId/:tanev", async (req, res) => {
  try {
    const { alapadatokId, tanev } = req.params;

    await deleteAllByAlapadatok(alapadatokId, tanev);

    return res.status(204).send();
  } catch (error) {
    console.error(
      "Error deleting sajatos nevelesu tanulok data by alapadatok:",
      error
    );
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
