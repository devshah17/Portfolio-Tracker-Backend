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
