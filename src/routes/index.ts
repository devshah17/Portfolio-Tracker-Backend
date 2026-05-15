import { Router } from "express";
import userRoutes from "./userRoutes";
import tickerRoutes from "./tickerRoutes";
import portfolioRoutes from "./portfolioRoutes";
import portfolioGroupRoutes from "./portfolioGroupRoutes";
import dashboardRoutes from "./dashboardRoutes";
import transactionRoutes from "./transactionRoutes";

const router = Router();

router.use("/user", userRoutes);
router.use("/tickers", tickerRoutes);
router.use("/portfolios", portfolioRoutes);
router.use("/portfolio-groups", portfolioGroupRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/transactions", transactionRoutes);

export default router;