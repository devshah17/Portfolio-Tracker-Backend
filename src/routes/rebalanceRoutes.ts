import express from "express";
import { getRebalanceData, updateTargetAllocations } from "../controllers/rebalanceController.js";

const router = express.Router();

router.get("/:userId", getRebalanceData);
router.put("/:userId/targets", updateTargetAllocations);

export default router;
