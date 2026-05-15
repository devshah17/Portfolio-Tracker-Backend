import cron from "node-cron";
import { updateTickerPrices } from "../services/cronServices";

export const initCronJobs = () => {
  // Run every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    await updateTickerPrices();
  });

  console.log("CRON: Jobs initialized (every 30 minutes)");
  
  // Also run once on startup to ensure we have data
  updateTickerPrices();
};
