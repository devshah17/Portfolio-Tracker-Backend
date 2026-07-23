import { Router } from "express";
import { getDashboardStatsController, getHistoricalGrowthController } from "../controllers/dashboardController.js";

const router = Router();

router.get("/stats/:userId", getDashboardStatsController);
router.get("/historical/:userId", getHistoricalGrowthController);

export default router;
