import e from "express";
import { getAll, createMany } from "../services/tanulo_adatszolg.service.js";

const router = e.Router();

router.get("/:alapadatok_id/:ev", async (req, res) => {
  try {
    const { alapadatok_id, ev } = req.params;
    const data = await getAll(alapadatok_id, ev);
    res.json(data);
  } catch (err) {
    console.error("Error fetching tanulo_adatszolgaltatas:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { alapadatok_id, tanulo_adatszolgaltatas, tanev_kezdete } = req.body;
    const result = await createMany(
      alapadatok_id,
      tanulo_adatszolgaltatas,
      tanev_kezdete
    );
    res.status(201).json(result);
  } catch (err) {
    console.error("Error creating tanulo_adatszolgaltatas:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
