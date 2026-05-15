import { Router } from "express";
import {
  createPortfolioGroupController,
  getUserPortfolioGroupsController,
  deletePortfolioGroupController,
  getGroupItemsController,
  addEntryToGroupController,
  removeEntryFromGroupController,
} from "../controllers/portfolioGroupController";

const router = Router();

// Create portfolio group
router.post("/", createPortfolioGroupController);

// Get all groups for a user
router.get("/user/:userId", getUserPortfolioGroupsController);

// Delete a group
router.delete("/:id", deletePortfolioGroupController);

// Get items in a group  (GET /portfolio-groups/:id/items?userId=...)
router.get("/:id/items", getGroupItemsController);

// Add asset to a group
router.post("/:id/entries", addEntryToGroupController);

// Remove asset from a group
router.delete("/:id/entries/:portfolioItemId", removeEntryFromGroupController);

export default router;
