import { Request, Response } from "express";
import * as dashboardService from "../services/dashboardServices.js";

export const getDashboardStatsController = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    const stats = await dashboardService.getDashboardStats(userId as string);
    res.status(200).json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHistoricalGrowthController = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const periodDays = req.query.days ? parseInt(req.query.days as string, 10) : 365;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    const data = await dashboardService.getHistoricalPerformance(userId as string, periodDays);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
