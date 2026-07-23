import { Router } from "express";
import { authenticateToken } from "../middlewares/authentication.js";
import {
  getMutualFunds,
  createMutualFund,
  deleteMutualFund,
  uploadFundReport,
  getFundReports,
} from "../controllers/fundRadarController.js";

const router = Router();

// Requires authentication for all routes
router.use(authenticateToken);

router.get("/", getMutualFunds);
router.post("/", createMutualFund);
router.delete("/:id", deleteMutualFund);

router.post("/:id/upload", uploadFundReport);
router.get("/:id/reports", getFundReports);

export default router;
