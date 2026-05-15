import { Router } from "express";
import { getDashboardStatsController } from "../controllers/dashboardController";

const router = Router();

router.get("/stats/:userId", getDashboardStatsController);

export default router;
