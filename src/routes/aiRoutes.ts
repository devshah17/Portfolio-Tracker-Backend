import express from "express";
import { queryInvestmentAnalyst, getPortfolioAdvisorAnalysis } from "../controllers/aiController.js";
import { authenticateToken } from "../middlewares/authentication.js";

const router = express.Router();

router.post("/query", authenticateToken, queryInvestmentAnalyst);
router.post("/portfolio-analysis", authenticateToken, getPortfolioAdvisorAnalysis);

export default router;
