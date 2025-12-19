import e from "express";
import { getAll, createMany } from "../services/oktato_adatszolg.service.js";

const router = e.Router();

router.get("/:alapadatok_id/:ev", async (req, res) => {
  try {
    const { alapadatok_id, ev } = req.params;
    const data = await getAll(alapadatok_id, ev);
    res.json(data);
  } catch (err) {
    console.error("Error fetching oktato_adatszolgaltatas:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { alapadatok_id, oktato_adatszolgaltatas, tanev_kezdete } = req.body;
    const result = await createMany(
      alapadatok_id,
      oktato_adatszolgaltatas,
      tanev_kezdete
    );
    res.status(201).json(result);
  } catch (err) {
    console.error("Error creating oktato_adatszolgaltatas:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
