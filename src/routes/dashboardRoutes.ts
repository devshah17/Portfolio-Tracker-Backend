import { Router } from "express";
import { getDashboardStatsController } from "../controllers/dashboardController.js";

const router = Router();

router.get("/stats/:userId", getDashboardStatsController);

export default router;
