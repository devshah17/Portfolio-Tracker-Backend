import { Router } from "express";
import {
  addPortfolioItemController,
  getUserPortfolioController,
  deletePortfolioItemController,
  updatePortfolioItemController,
} from "../controllers/portfolioController.js";

const router = Router();

// Add to portfolio
router.post("/", addPortfolioItemController);

// Get user's portfolio
router.get("/user/:userId", getUserPortfolioController);

// Delete portfolio item
router.delete("/:id", deletePortfolioItemController);

// Update portfolio item
router.put("/:id", updatePortfolioItemController);

export default router;
