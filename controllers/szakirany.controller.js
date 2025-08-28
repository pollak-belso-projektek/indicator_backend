import express from "express";
import { getAll } from "../services/szakirany.service.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const data = await getAll();
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching szakirany:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
