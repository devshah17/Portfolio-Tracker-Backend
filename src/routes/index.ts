import { Router } from "express";
import userRoutes from "./userRoutes";
import tickerRoutes from "./tickerRoutes";
import dailyPriceRoutes from "./dailyPriceRoutes";

const router = Router();

router.use("/user", userRoutes);
router.use("/tickers", tickerRoutes);
router.use("/daily-prices", dailyPriceRoutes);

export default router;