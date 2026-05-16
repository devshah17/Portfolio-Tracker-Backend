import express from "express";
import {
  addTransactionController,
  deleteTransactionController,
  updateTransactionController,
  getTransactionStatsController
} from "../controllers/transactionController.js";

const router = express.Router();

router.post("/:userId", addTransactionController);
router.delete("/:userId/:txnId", deleteTransactionController);
router.put("/:userId/:txnId", updateTransactionController);
router.get("/:userId/stats", getTransactionStatsController);

export default router;
