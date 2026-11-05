import e from "express";
import {
  getAll,
  getNappaliClasses,
  createMany,
} from "../services/osztaly_adatszolg.service.js";

const router = e.Router();

router.get("/:alapadatok_id/:ev", async (req, res) => {
  try {
    const { alapadatok_id, ev } = req.params;
    const data = await getAll(alapadatok_id, ev);
    res.json(data);
  } catch (err) {
    console.error("Error fetching osztaly_adatszolgaltatas:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:alapadatok_id/:ev/nappali", async (req, res) => {
  try {
    const { alapadatok_id, ev } = req.params;
    const data = await getNappaliClasses(alapadatok_id, ev);
    res.json(data);
  } catch (err) {
    console.error("Error fetching nappali classes:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { alapadatok_id, osztaly_adatszolgaltatas, tanev_kezdete } = req.body;
    const userId = req.user?.id || req.body.userId || "cc2c2d68-5b38-4f9b-9e4f-1a3c9a0fb2a4";
    const result = await createMany(
      alapadatok_id,
      osztaly_adatszolgaltatas,
      tanev_kezdete,
      userId
    );
    res.status(201).json(result);
  } catch (err) {
    console.error("Error creating osztaly_adatszolgaltatas:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
