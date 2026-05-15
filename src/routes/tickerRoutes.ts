import { Router } from "express";
import {
  createTickerController,
  deleteTickerController,
  getAllTickersController,
  getTickerByIdController,
  updateTickerController,
  getLatestPricesController,
  getCurrentExchangeRatesController,
  getTickerDailyPricesController,
} from "../controllers/tickerController";

const router = Router();

// Create
router.post("/", createTickerController);

// Read all
router.get("/", getAllTickersController);

// Read latest prices
router.get("/getLatestPrices", getLatestPricesController);

// Latest FX rates per ticker (reference only; P&L uses purchase rate)
router.get("/exchange-rates", getCurrentExchangeRatesController);

// Daily price history for chart
router.get("/:id/daily-prices", getTickerDailyPricesController);

// Read one by ID
router.get("/:id", getTickerByIdController);

// Update
router.put("/:id", updateTickerController);

// Delete
router.delete("/:id", deleteTickerController);

export default router;

