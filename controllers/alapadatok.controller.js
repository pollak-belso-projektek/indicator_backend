import express from "express";
import {
  add,
  getAll,
  getById,
  update,
  removeSzakmaFromAlapadatok,
} from "../services/alapadatok.service.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Alapadatok
 *   description: School basic information management
 *
 * components:
 *   schemas:
 *     Alapadatok:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier
 *           example: 1
 *         iskola_neve:
 *           type: string
 *           description: School name
 *           example: "Pollák Antal Technikum"
 *         intezmeny_tipus:
 *           type: string
 *           description: Institution type
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
 *         - iskola_neve
 *         - intezmeny_tipus
 */

/**
 * @swagger
 * /alapadatok:
 *   get:
 *     summary: Get all schools data
 *     description: Retrieve a list of all schools basic information
 *     tags: [Alapadatok]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success - List of school data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Alapadatok'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Szerver hiba!"
 *                 error:
 *                   type: object
 */
router.get("/", async (req, res) => {
  try {
    const data = await getAll();
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Szerver hiba!", error: error });
  }
});

/**
 * @swagger
 * /alapadatok/{id}:
 *   get:
 *     summary: Get school data by ID
 *     description: Retrieve school information by its unique ID
 *     tags: [Alapadatok]
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
 *         description: Success - School data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alapadatok'
 *       400:
 *         description: Invalid parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "A paraméter nem megfelelő"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!id)
      return res.status(400).json({ message: "A paraméter nem megfelelő" });

    const data = await getById(id);
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Szerver hiba!", error: error });
  }
});

/**
 * @swagger
 * /alapadatok:
 *   post:
 *     summary: Create new school record
 *     description: Add a new school with basic information
 *     tags: [Alapadatok]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - iskola_neve
 *               - intezmeny_tipus
 *             properties:
 *               iskola_neve:
 *                 type: string
 *                 example: "Pollák Antal Technikum"
 *               intezmeny_tipus:
 *                 type: string
 *                 example: "Technikum"
 *     responses:
 *       201:
 *         description: Successfully created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sikeresen létrehozva!"
 *       400:
 *         description: Missing data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Hiányos adatok!"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */
router.post("/", async (req, res) => {
  try {
    const { iskola_neve, intezmeny_tipus, alapadatok_szakirany } = req.body;

    console.log("Adding alapadatok:", {
      iskola_neve,
      intezmeny_tipus,
      alapadatok_szakirany,
    });

    if (!iskola_neve || !intezmeny_tipus || !alapadatok_szakirany)
      return res.status(400).json({ message: "Hiányos adatok!" });

    await add(iskola_neve, intezmeny_tipus, alapadatok_szakirany);

    res.status(201).json({ message: "Sikeresen létrehozva!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Szerver hiba!", error: error });
  }
});

/**
 * @swagger
 * /alapadatok/{id}:
 *   put:
 *     summary: Update school data
 *     description: Update an existing school record by ID
 *     tags: [Alapadatok]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: School unique identifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - iskola_neve
 *               - intezmeny_tipus
 *             properties:
 *               iskola_neve:
 *                 type: string
 *                 example: "Pollák Antal Technikum - Updated"
 *               intezmeny_tipus:
 *                 type: string
 *                 example: "Technikum"
 *     responses:
 *       200:
 *         description: Successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sikeresen frissítve!"
 *       400:
 *         description: Missing data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Hiányos adatok!"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { iskola_neve, intezmeny_tipus, alapadatok_szakirany } = req.body;

    if (!id || !iskola_neve || !intezmeny_tipus)
      return res.status(400).json({ message: "Hiányos adatok!" });

    if (
      intezmeny_tipus != "Technikum" &&
      intezmeny_tipus != "Szakképző iskola" &&
      intezmeny_tipus != "Technikum és Szakképző iskola"
    ) {
      return res.status(400).json({
        message:
          "Az intézmény típusa csak Technikum vagy Szakképző iskola lehet vagy Technikum és Szakképző iskola!",
      });
    }

    await update(id, iskola_neve, intezmeny_tipus, alapadatok_szakirany);

    res.status(200).json({ message: "Sikeresen frissítve!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Szerver hiba!", error: error });
  }
});

/**
 * @swagger
 * /alapadatok/removeSzakma/{alapadatokId}/{szakmaId}:
 *   delete:
 *     summary: Remove szakma from alapadatok
 *     description: Remove a szakma association from a specific alapadatok record
 *     tags: [Alapadatok]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alapadatokId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the alapadatok record
 *       - in: path
 *         name: szakmaId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the szakma to be removed
 *     responses:
 *       200:
 *         description: Sikeresen frissítve
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sikeresen frissítve!"
 *       400:
 *         description: Hiányos adatok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Hiányos adatok!"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Szerver hiba!"
 *                 error:
 *                   type: object
 *                   example: {}
 */
router.delete("/removeSzakma/:alapadatokId/:szakmaId", async (req, res) => {
  try {
    const { alapadatokId, szakmaId } = req.params;

    if (!alapadatokId || !szakmaId)
      return res.status(400).json({ message: "Hiányos adatok!" });

    await removeSzakmaFromAlapadatok(alapadatokId, szakmaId);

    res.status(200).json({ message: "Sikeresen frissítve!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Szerver hiba!", error: error });
  }
});

export default router;
