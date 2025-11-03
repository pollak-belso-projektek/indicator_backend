import e from "express";
import {
  getAll,
  getAllByAlapadatok,
  getById,
  create,
  update,
  deleteById,
} from "../services/oktato_egyeb_tev.service.js";

const router = e.Router();

/**
 * @swagger
 * tags:
 *   name: OktatoEgyebTev
 *   description: Teachers' other activities data management endpoints
 *
 * components:
 *   schemas:
 *     OktatoEgyebTev:
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
 *         szakkepzesi_szakerto:
 *           type: integer
 *           nullable: true
 *           description: Number of vocational training experts
 *           example: 5
 *         koznevelesi_szakerto:
 *           type: integer
 *           nullable: true
 *           description: Number of public education experts
 *           example: 3
 *         koznevelesi_szaktanacsado:
 *           type: integer
 *           nullable: true
 *           description: Number of public education advisors
 *           example: 2
 *         vizsgafelugyelo:
 *           type: integer
 *           nullable: true
 *           description: Number of exam supervisors
 *           example: 8
 *         agazati_alapvizsgan_elnok:
 *           type: integer
 *           nullable: true
 *           description: Number of sectoral basic exam chairpersons
 *           example: 1
 *         feladatkeszito_lektor:
 *           type: integer
 *           nullable: true
 *           description: Number of task creators/lecturers
 *           example: 4
 *         erettsegi_elnok:
 *           type: integer
 *           nullable: true
 *           description: Number of graduation exam chairpersons
 *           example: 2
 *         emelt_erettsegi_vb_tag:
 *           type: integer
 *           nullable: true
 *           description: Number of advanced graduation exam committee members
 *           example: 3
 *         emelt_erettsegi_vb_elnok:
 *           type: integer
 *           nullable: true
 *           description: Number of advanced graduation exam committee chairpersons
 *           example: 1
 *         erettsegi_vizsgaztato:
 *           type: integer
 *           nullable: true
 *           description: Number of graduation exam examiners
 *           example: 6
 *         tanterviro:
 *           type: integer
 *           nullable: true
 *           description: Number of curriculum writers
 *           example: 2
 *         tananyagfejleszto:
 *           type: integer
 *           nullable: true
 *           description: Number of material developers
 *           example: 4
 *         tankonyv_jegyzetiro:
 *           type: integer
 *           nullable: true
 *           description: Number of textbook/note writers
 *           example: 3
 *         szakmai_tisztsegviselo:
 *           type: integer
 *           nullable: true
 *           description: Number of professional office holders
 *           example: 2
 *         createAt:
 *           type: string
 *           format: date-time
 *           description: When the record was created
 *           example: "2024-01-01T00:00:00.000Z"
 *         createBy:
 *           type: string
 *           nullable: true
 *           description: Who created the record
 *           example: "user123"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the record was last updated
 *           example: "2024-01-02T00:00:00.000Z"
 *         updatedBy:
 *           type: string
 *           nullable: true
 *           description: Who last updated the record
 *           example: "user456"
 *
 *     OktatoEgyebTevCreate:
 *       type: object
 *       required:
 *         - alapadatok_id
 *         - tanev_kezdete
 *       properties:
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
 *         szakkepzesi_szakerto:
 *           type: integer
 *           nullable: true
 *           description: Number of vocational training experts
 *           example: 5
 *         koznevelesi_szakerto:
 *           type: integer
 *           nullable: true
 *           description: Number of public education experts
 *           example: 3
 *         koznevelesi_szaktanacsado:
 *           type: integer
 *           nullable: true
 *           description: Number of public education advisors
 *           example: 2
 *         vizsgafelugyelo:
 *           type: integer
 *           nullable: true
 *           description: Number of exam supervisors
 *           example: 8
 *         agazati_alapvizsgan_elnok:
 *           type: integer
 *           nullable: true
 *           description: Number of sectoral basic exam chairpersons
 *           example: 1
 *         feladatkeszito_lektor:
 *           type: integer
 *           nullable: true
 *           description: Number of task creators/lecturers
 *           example: 4
 *         erettsegi_elnok:
 *           type: integer
 *           nullable: true
 *           description: Number of graduation exam chairpersons
 *           example: 2
 *         emelt_erettsegi_vb_tag:
 *           type: integer
 *           nullable: true
 *           description: Number of advanced graduation exam committee members
 *           example: 3
 *         emelt_erettsegi_vb_elnok:
 *           type: integer
 *           nullable: true
 *           description: Number of advanced graduation exam committee chairpersons
 *           example: 1
 *         erettsegi_vizsgaztato:
 *           type: integer
 *           nullable: true
 *           description: Number of graduation exam examiners
 *           example: 6
 *         tanterviro:
 *           type: integer
 *           nullable: true
 *           description: Number of curriculum writers
 *           example: 2
 *         tananyagfejleszto:
 *           type: integer
 *           nullable: true
 *           description: Number of material developers
 *           example: 4
 *         tankonyv_jegyzetiro:
 *           type: integer
 *           nullable: true
 *           description: Number of textbook/note writers
 *           example: 3
 *         szakmai_tisztsegviselo:
 *           type: integer
 *           nullable: true
 *           description: Number of professional office holders
 *           example: 2
 *         createBy:
 *           type: string
 *           nullable: true
 *           description: Who is creating the record
 *           example: "user123"
 *
 *     OktatoEgyebTevUpdate:
 *       type: object
 *       properties:
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
 *         szakkepzesi_szakerto:
 *           type: integer
 *           nullable: true
 *           description: Number of vocational training experts
 *           example: 5
 *         koznevelesi_szakerto:
 *           type: integer
 *           nullable: true
 *           description: Number of public education experts
 *           example: 3
 *         koznevelesi_szaktanacsado:
 *           type: integer
 *           nullable: true
 *           description: Number of public education advisors
 *           example: 2
 *         vizsgafelugyelo:
 *           type: integer
 *           nullable: true
 *           description: Number of exam supervisors
 *           example: 8
 *         agazati_alapvizsgan_elnok:
 *           type: integer
 *           nullable: true
 *           description: Number of sectoral basic exam chairpersons
 *           example: 1
 *         feladatkeszito_lektor:
 *           type: integer
 *           nullable: true
 *           description: Number of task creators/lecturers
 *           example: 4
 *         erettsegi_elnok:
 *           type: integer
 *           nullable: true
 *           description: Number of graduation exam chairpersons
 *           example: 2
 *         emelt_erettsegi_vb_tag:
 *           type: integer
 *           nullable: true
 *           description: Number of advanced graduation exam committee members
 *           example: 3
 *         emelt_erettsegi_vb_elnok:
 *           type: integer
 *           nullable: true
 *           description: Number of advanced graduation exam committee chairpersons
 *           example: 1
 *         erettsegi_vizsgaztato:
 *           type: integer
 *           nullable: true
 *           description: Number of graduation exam examiners
 *           example: 6
 *         tanterviro:
 *           type: integer
 *           nullable: true
 *           description: Number of curriculum writers
 *           example: 2
 *         tananyagfejleszto:
 *           type: integer
 *           nullable: true
 *           description: Number of material developers
 *           example: 4
 *         tankonyv_jegyzetiro:
 *           type: integer
 *           nullable: true
 *           description: Number of textbook/note writers
 *           example: 3
 *         szakmai_tisztsegviselo:
 *           type: integer
 *           nullable: true
 *           description: Number of professional office holders
 *           example: 2
 *         updatedBy:
 *           type: string
 *           nullable: true
 *           description: Who is updating the record
 *           example: "user456"
 */

/**
 * @swagger
 * /oktato-egyeb-tev:
 *   get:
 *     summary: Get all teachers' other activities data
 *     tags: [OktatoEgyebTev]
 *     parameters:
 *       - in: query
 *         name: tanev
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1900
 *           maximum: 2100
 *         description: Academic year start (e.g., 2024 for 2024/2025)
 *         example: 2024
 *     responses:
 *       200:
 *         description: List of teachers' other activities data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/OktatoEgyebTev'
 *       400:
 *         description: Missing or invalid tanev parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "tanev parameter is required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get("/", async (req, res) => {
  try {
    const { tanev } = req.query;

    if (!tanev) {
      return res.status(400).json({ error: "tanev parameter is required" });
    }

    const tanev_int = parseInt(tanev);
    if (isNaN(tanev_int)) {
      return res.status(400).json({ error: "tanev must be a valid integer" });
    }
    const data = await getAll(tanev_int);
    res.json(data);
  } catch (error) {
    console.error("Error fetching teachers' other activities data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /oktato-egyeb-tev/alapadatok/{alapadatokId}:
 *   get:
 *     summary: Get teachers' other activities data by school ID
 *     tags: [OktatoEgyebTev]
 *     parameters:
 *       - in: path
 *         name: alapadatokId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: School's basic data ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: tanev
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1900
 *           maximum: 2100
 *         description: Academic year start (e.g., 2024 for 2024/2025)
 *         example: 2024
 *     responses:
 *       200:
 *         description: Teachers' other activities data for the specified school
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/OktatoEgyebTev'
 *       400:
 *         description: Missing or invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "tanev parameter is required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get("/alapadatok/:alapadatokId", async (req, res) => {
  try {
    const { alapadatokId } = req.params;
    const { tanev } = req.query;

    if (!tanev) {
      return res.status(400).json({ error: "tanev parameter is required" });
    }

    const tanev_int = parseInt(tanev);
    if (isNaN(tanev_int)) {
      return res.status(400).json({ error: "tanev must be a valid integer" });
    }

    const data = await getAllByAlapadatok(alapadatokId, tanev_int);

    res.json(data);
  } catch (error) {
    console.error(
      "Error fetching teachers' other activities data by school:",
      error
    );
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /oktato-egyeb-tev/{id}:
 *   get:
 *     summary: Get teachers' other activities data by ID
 *     tags: [OktatoEgyebTev]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Record ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Teachers' other activities data record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OktatoEgyebTev'
 *       404:
 *         description: Record not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Record not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = await getById(id);

    if (!data) {
      return res.status(404).json({ error: "Record not found" });
    }

    res.json(data);
  } catch (error) {
    console.error(
      "Error fetching teachers' other activities data by ID:",
      error
    );
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /oktato-egyeb-tev:
 *   post:
 *     summary: Create new teachers' other activities data
 *     tags: [OktatoEgyebTev]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OktatoEgyebTevCreate'
 *     responses:
 *       201:
 *         description: Teachers' other activities data created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OktatoEgyebTev'
 *       400:
 *         description: Missing required fields or invalid data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "alapadatok_id and tanev_kezdete are required"
 *       500:
 *         description: Internal server error
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
      szakkepzesi_szakerto,
      koznevelesi_szakerto,
      koznevelesi_szaktanacsado,
      vizsgafelugyelo,
      agazati_alapvizsgan_elnok,
      feladatkeszito_lektor,
      erettsegi_elnok,
      emelt_erettsegi_vb_tag,
      emelt_erettsegi_vb_elnok,
      erettsegi_vizsgaztato,
      tanterviro,
      tananyagfejleszto,
      tankonyv_jegyzetiro,
      szakmai_tisztsegviselo,
      oktatok_letszama,
      createBy,
      szakmai_vizsga_mero_ertekelo,
    } = req.body;

    // Validate required fields
    if (!alapadatok_id || !tanev_kezdete) {
      return res.status(400).json({
        error: "alapadatok_id and tanev_kezdete are required",
      });
    }

    const newEntry = await create(
      alapadatok_id,
      tanev_kezdete,
      szakkepzesi_szakerto,
      koznevelesi_szakerto,
      koznevelesi_szaktanacsado,
      vizsgafelugyelo,
      agazati_alapvizsgan_elnok,
      feladatkeszito_lektor,
      erettsegi_elnok,
      emelt_erettsegi_vb_tag,
      emelt_erettsegi_vb_elnok,
      erettsegi_vizsgaztato,
      tanterviro,
      tananyagfejleszto,
      tankonyv_jegyzetiro,
      szakmai_tisztsegviselo,
      oktatok_letszama,
      createBy,
      szakmai_vizsga_mero_ertekelo
    );

    res.status(201).json(newEntry);
  } catch (error) {
    console.error("Create error details:", error);
    // Handle validation errors from service
    if (
      error.message.includes("is required") ||
      error.message.includes("must be a valid")
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error creating teachers' other activities data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /oktato-egyeb-tev/{id}:
 *   put:
 *     summary: Update teachers' other activities data
 *     tags: [OktatoEgyebTev]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Record ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OktatoEgyebTevUpdate'
 *     responses:
 *       200:
 *         description: Teachers' other activities data updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OktatoEgyebTev'
 *       400:
 *         description: Missing required fields or invalid data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "alapadatok_id and tanev_kezdete are required"
 *       404:
 *         description: Record not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Record not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      alapadatok_id,
      tanev_kezdete,
      szakkepzesi_szakerto,
      koznevelesi_szakerto,
      koznevelesi_szaktanacsado,
      vizsgafelugyelo,
      agazati_alapvizsgan_elnok,
      feladatkeszito_lektor,
      erettsegi_elnok,
      emelt_erettsegi_vb_tag,
      emelt_erettsegi_vb_elnok,
      erettsegi_vizsgaztato,
      tanterviro,
      tananyagfejleszto,
      tankonyv_jegyzetiro,
      szakmai_tisztsegviselo,
      oktatok_letszama,
      updatedBy,
      szakmai_vizsga_mero_ertekelo,
    } = req.body;

    // Validate required fields
    if (!alapadatok_id || !tanev_kezdete) {
      return res.status(400).json({
        error: "alapadatok_id and tanev_kezdete are required",
      });
    }

    const updatedEntry = await update(
      id,
      alapadatok_id,
      tanev_kezdete,
      szakkepzesi_szakerto,
      koznevelesi_szakerto,
      koznevelesi_szaktanacsado,
      vizsgafelugyelo,
      agazati_alapvizsgan_elnok,
      feladatkeszito_lektor,
      erettsegi_elnok,
      emelt_erettsegi_vb_tag,
      emelt_erettsegi_vb_elnok,
      erettsegi_vizsgaztato,
      tanterviro,
      tananyagfejleszto,
      tankonyv_jegyzetiro,
      szakmai_tisztsegviselo,
      oktatok_letszama,
      updatedBy,
      szakmai_vizsga_mero_ertekelo
    );

    res.json(updatedEntry);
  } catch (error) {
    console.error("Update error details:", error);
    // Handle validation errors from service
    if (
      error.message.includes("is required") ||
      error.message.includes("must be a valid")
    ) {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Record not found" });
    }
    console.error("Error updating teachers' other activities data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /oktato-egyeb-tev/{id}:
 *   delete:
 *     summary: Delete teachers' other activities data
 *     tags: [OktatoEgyebTev]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Record ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Teachers' other activities data deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Record deleted successfully"
 *                 deletedRecord:
 *                   $ref: '#/components/schemas/OktatoEgyebTev'
 *       404:
 *         description: Record not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Record not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedEntry = await deleteById(id);
    res.json({
      message: "Record deleted successfully",
      deletedRecord: deletedEntry,
    });
  } catch (error) {
    console.error("Delete error details:", error);
    if (error.message === "Entry not found") {
      return res.status(404).json({ error: "Record not found" });
    }
    console.error("Error deleting teachers' other activities data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
