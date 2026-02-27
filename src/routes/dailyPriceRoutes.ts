import { Router } from "express";
import {
  bulkCreateDailyPricesController,
  getDailyPricesByTickerIdController,
  getLatestPriceByTickerIdController,
  getDailyPricesByDateController,
  bulkUpdateDailyPricesController,
} from "../controllers/dailyPriceController";

const router = Router();

// Bulk create daily prices
router.post("/bulk", bulkCreateDailyPricesController);

// Bulk update daily prices (upsert)
router.put("/bulk", bulkUpdateDailyPricesController);

// Get daily prices by ticker ID
router.get("/ticker/:tickerId", getDailyPricesByTickerIdController);

// Get latest price by ticker ID
router.get("/ticker/:tickerId/latest", getLatestPriceByTickerIdController);

// Get all daily prices for a specific date
router.get("/date/:date", getDailyPricesByDateController);

export default router;
