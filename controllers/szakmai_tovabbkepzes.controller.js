import e from "express";
import * as szakmaiTovabbkepzesService from "../services/szakmai_tovabbkepzes.service.js";
import { currentAcademicYear } from "../utils/academicYear.js";

const router = e.Router();

export const bulkUpsert = async (req, res, next) => {
  try {
    const data = req.body;

    if (!Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        message: "Data must be an array of objects",
      });
    }

    // Since we receive an array, we get the alapadatok_id from the first item
    const idToUse = data.length > 0 ? data[0].alapadatok_id : null;
    
    if (!idToUse && data.length > 0) {
       return res.status(400).json({
         success: false,
         message: "Missing alapadatok_id in data",
       });
    }

    if (data.length === 0) {
        return res.status(200).json({
            success: true,
            message: "Empty array provided",
            data: [],
        });
    }

    const results = await szakmaiTovabbkepzesService.upsertBulk(idToUse, data);

    res.status(200).json({
      success: true,
      message: "Bulk upsert successful",
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

router.get("/:alapadatok_id/:tanev", async (req, res, next) => {
  try {
    const { alapadatok_id, tanev } = req.params;
    const data = await szakmaiTovabbkepzesService.getAllByAlapadatok(alapadatok_id, parseInt(tanev));
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/:alapadatok_id", async (req, res, next) => {
  try {
    const { alapadatok_id } = req.params;
    const currentYear = currentAcademicYear();
    const data = await szakmaiTovabbkepzesService.getAllByAlapadatok(alapadatok_id, currentYear);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
});

router.post("/", bulkUpsert);

export default router;
