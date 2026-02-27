import { Router } from "express";
import {
  createTickerController,
  deleteTickerController,
  getAllTickersController,
  getTickerByIdController,
  updateTickerController,
} from "../controllers/tickerController";

const router = Router();

// Create
router.post("/", createTickerController);

// Read all
router.get("/", getAllTickersController);

// Read one by ID
router.get("/:id", getTickerByIdController);

// Update
router.put("/:id", updateTickerController);

// Delete
router.delete("/:id", deleteTickerController);

export default router;

