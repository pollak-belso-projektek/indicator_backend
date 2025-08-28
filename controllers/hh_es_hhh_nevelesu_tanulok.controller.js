import e from "express";
import {
  getAll,
  getAllByAlapadatok,
  create,
  deleteAllByAlapadatok,
  update,
} from "../services/hh_es_hhh_nevelesu_tanulok.service.js";

const router = e.Router();

/**
 * @swagger
 * tags:
 *   name: HH_es_HHH_nevelesu_tanulok
 *   description: Disadvantaged students data management
 *
 * components:
 *   schemas:
 *     HHesHHHNeveluTanulok:
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
 *         hh_tanulo_letszam:
 *           type: integer
 *           description: Number of disadvantaged students (HH and HHH)
 *           example: 33
 *         tanuloi_osszletszam:
 *           type: integer
 *           description: Total number of students
 *           example: 450
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
 *         - hh_tanulo_letszam
 *         - tanuloi_osszletszam
 */

/**
 * @swagger
 * /hh_es_hhh/{tanev}:
 *   get:
 *     summary: Get disadvantaged students data by school year
 *     description: Retrieve disadvantaged students (HH and HHH) data for a specific school year and previous 4 years
 *     tags: [HH_es_HHH_nevelesu_tanulok]
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
 *         description: Disadvantaged students data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/HHesHHHNeveluTanulok'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get("/:tanev", async (req, res) => {
  try {
    const tanev = req.params.tanev;
    const data = await getAll(tanev);

    return res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching elhelyezkedes data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /hh_es_hhh/{alapadatokId}/{tanev}:
 *   get:
 *     summary: Get disadvantaged students data by school and year
 *     description: Retrieve disadvantaged students data for a specific school and school year
 *     tags: [HH_es_HHH_nevelesu_tanulok]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alapadatokId
 *         required: true
 *         description: The school identifier
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: path
 *         name: tanev
 *         required: true
 *         description: The school year end
 *         schema:
 *           type: integer
 *           example: 2024
 *     responses:
 *       200:
 *         description: Disadvantaged students data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/HHesHHHNeveluTanulok'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 *   delete:
 *     summary: Delete disadvantaged students data by school and year
 *     description: Delete all disadvantaged students data for a specific school and school year
 *     tags: [HH_es_HHH_nevelesu_tanulok]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alapadatokId
 *         required: true
 *         description: The school identifier
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: path
 *         name: tanev
 *         required: true
 *         description: The school year end
 *         schema:
 *           type: integer
 *           example: 2024
 *     responses:
 *       204:
 *         description: Disadvantaged students data deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get("/:alapadatokId/:tanev", async (req, res) => {
  try {
    const alapadatokId = req.params.alapadatokId;
    const tanev = req.params.tanev;
    const data = await getAllByAlapadatok(alapadatokId, tanev);

    return res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching elhelyezkedes data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /hh_es_hhh:
 *   post:
 *     summary: Create new disadvantaged students data
 *     description: Create new disadvantaged students data entry
 *     tags: [HH_es_HHH_nevelesu_tanulok]
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
 *               - hh_tanulo_letszam
 *               - tanuloi_osszletszam
 *             properties:
 *               alapadatok_id:
 *                 type: integer
 *                 description: School identifier reference
 *                 example: 1
 *               tanev_kezdete:
 *                 type: integer
 *                 description: School year start year
 *                 example: 2023
 *               hh_tanulo_letszam:
 *                 type: integer
 *                 description: Number of disadvantaged students (HH and HHH)
 *                 example: 33
 *               tanuloi_osszletszam:
 *                 type: integer
 *                 description: Total number of students
 *                 example: 450
 *     responses:
 *       201:
 *         description: Disadvantaged students data created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HHesHHHNeveluTanulok'
 *       400:
 *         description: Bad request - Invalid input data
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.post("/", async (req, res) => {
  try {
    const {
      alapadatok_id,
      tanev_kezdete,
      jogviszony_tipus,
      hh_tanulo_letszam,
      tanuloi_osszletszam,
    } = req.body;

    const createdData = await create(
      alapadatok_id,
      tanev_kezdete,
      jogviszony_tipus,
      hh_tanulo_letszam,
      tanuloi_osszletszam
    );

    return res.status(201).json(createdData);
  } catch (error) {
    console.error("Error creating elhelyezkedes data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    console.log("Updating elhelyezkedes data:", id);
    const {
      alapadatok_id,
      tanev_kezdete,
      jogviszony_tipus,
      hh_tanulo_letszam,
      tanuloi_osszletszam,
    } = req.body;

    const updatedData = await update(
      id,
      alapadatok_id,
      tanev_kezdete,
      jogviszony_tipus,
      hh_tanulo_letszam,
      tanuloi_osszletszam
    );

    return res.status(200).json(updatedData);
  } catch (error) {
    console.error("Error updating elhelyezkedes data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:alapadatokId/:tanev", async (req, res) => {
  try {
    const { alapadatokId, tanev } = req.params;

    await deleteAllByAlapadatok(alapadatokId, tanev);

    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting elhelyezkedes data by alapadatok:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
