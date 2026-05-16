import { Router } from "express";
import userRoutes from "./userRoutes.js";
import tickerRoutes from "./tickerRoutes.js";
import portfolioRoutes from "./portfolioRoutes.js";
import portfolioGroupRoutes from "./portfolioGroupRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import transactionRoutes from "./transactionRoutes.js";

const router = Router();

router.use("/user", userRoutes);
router.use("/tickers", tickerRoutes);
router.use("/portfolios", portfolioRoutes);
router.use("/portfolio-groups", portfolioGroupRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/transactions", transactionRoutes);

export default router;