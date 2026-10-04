import express from "express";
import multer from "multer";
import { createBugReport, getReportedBugs, updateBugStatus, getBugAttachment } from "../services/bugReport.service.js";



const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * tags:
 *   name: BugReports
 *   description: Bug report endpoints
 *
 * /bug-report:
 *   post:
 *     summary: Submit a new bug report
 *     description: Submit a new bug report. Will send email to superadmins and save to database.
 *     tags: [BugReports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high]
 *               stepsToReproduce:
 *                 type: string
 *               pageUrl:
 *                 type: string
 *               userAgent:
 *                 type: string
 *               attachment:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Bug report successfully submitted
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Internal server error
 */
router.post("/", upload.single("attachment"), async (req, res) => {
  try {
    const { title, description, severity, stepsToReproduce, pageUrl, userAgent } = req.body;

    // Validate required fields
    if (!title || !description) {
      return res.status(400).json({
        message: "Title and description are required fields."
      });
    }

    // req.user is set by authMiddleware
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Unauthorized: User information not found in token."
      });
    }

    const reporterInfo = {
      name: req.user.name || "Unknown User",
      email: req.user.email || "No email"
    };

    const bugReportData = {
      title,
      description,
      severity,
      stepsToReproduce,
      pageUrl,
      userAgent
    };

    const attachment = req.file || null;

    await createBugReport(req.user.id, bugReportData, reporterInfo, attachment);

    return res.status(201).json({
      message: "Hibabejelentés sikeresen elküldve."
    });
  } catch (error) {
    console.error("Error creating bug report:", error);
    return res.status(500).json({
      message: "Hiba történt a bejelentés küldése során. Kérjük, próbálja újra később."
    });
  }
});

/**
 * @swagger
 * /bug-report:
 *   get:
 *     summary: Get reported bugs
 *     description: Get a list of previously reported bugs from Trello
 *     tags: [BugReports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of reported bugs
 *       500:
 *         description: Internal server error
 */
router.get("/", async (req, res) => {
  try {
    const bugs = await getReportedBugs();
    return res.status(200).json(bugs);
  } catch (error) {
    console.error("Error fetching bug reports:", error);
    return res.status(500).json({
      message: "Hiba történt a hibajegyek lekérdezése során."
    });
  }
});

/**
 * @swagger
 * /bug-report/{id}/status:
 *   put:
 *     summary: Update bug report status
 *     description: Set bug report status to Kész or Folyamatban
 *     tags: [BugReports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Folyamatban, Ellenőrzésre vár, Kész]
 *     responses:
 *       200:
 *         description: Successfully updated
 *       500:
 *         description: Internal server error
 */
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["Folyamatban", "Ellenőrzésre vár", "Kész"].includes(status)) {
      return res.status(400).json({ message: "Érvénytelen státusz." });
    }

    // Must be superadmin
    if (!req.user || !req.user.permissions || !req.user.permissions.isSuperadmin) {
      return res.status(403).json({ message: "Nincs jogosultságod a hibajegy állapotának módosítására." });
    }

    await updateBugStatus(id, status);
    return res.status(200).json({ message: "Hibajegy állapota sikeresen frissítve." });
  } catch (error) {
    console.error("Error updating bug report status:", error);
    return res.status(500).json({
      message: "Hiba történt a hibajegy állapotának frissítése során."
    });
  }
});

/**
 * @swagger
 * /bug-report/attachment/{cardId}/{attachmentId}:
 *   get:
 *     summary: Get a bug report attachment
 *     description: Proxies an attachment from Trello to bypass authentication issues
 *     tags: [BugReports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attachment file
 *       500:
 *         description: Internal server error
 */
router.get("/attachment/:cardId/:attachmentId", async (req, res) => {
  try {
    const { cardId, attachmentId } = req.params;
    const { buffer, mimeType, name } = await getBugAttachment(cardId, attachmentId);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Error fetching bug report attachment:", error);
    return res.status(500).json({
      message: "Hiba történt a csatolmány lekérése során."
    });
  }
});

export default router;
