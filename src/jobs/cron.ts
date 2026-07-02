import cron from "node-cron";
import { updateTickerPrices } from "../services/cronServices.js";

export const initCronJobs = () => {
  // Run at 12:00 AM (midnight) and 12:00 PM (noon)
  cron.schedule("0 0,12 * * *", async () => {
    await updateTickerPrices();
  });

  console.log("CRON: Jobs initialized (noon and midnight)");
  
  // Also run once on startup to ensure we have data
  updateTickerPrices();
};
