import { Request, Response } from "express";
import {
  createDailyPrices,
  getDailyPricesByTickerId,
  getLatestPriceByTickerId,
  getDailyPricesByDate,
  bulkUpdateDailyPrices,
} from "../services/dailyPriceServices";

export const bulkCreateDailyPricesController = async (req: Request, res: Response) => {
  try {
    const { prices } = req.body;
    
    if (!prices || !Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ 
        message: "Prices array is required and cannot be empty" 
      });
    }
    
    // Validate each price object
    for (const price of prices) {
      if (!price.tickerId || !price.date || !price.price) {
        return res.status(400).json({ 
          message: "Each price object must contain tickerId, date, and price" 
        });
      }
    }
    
    const { message, data, count, error } = await createDailyPrices(prices);
    
    if (error) {
      return res.status(409).json({ message, error, data });
    }
    
    return res.status(201).json({ message, data, count });
  } catch (error: any) {
    console.error("Error bulk creating daily prices:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getDailyPricesByTickerIdController = async (req: Request, res: Response) => {
  try {
    const { tickerId } = req.params;
    const { limit } = req.query;
    
    // Ensure tickerId is a string
    const tickerIdStr = Array.isArray(tickerId) ? tickerId[0] : tickerId;
    
    const { message, data } = await getDailyPricesByTickerId(
      tickerIdStr, 
      limit ? parseInt(limit as string) : undefined
    );
    
    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.error("Error fetching daily prices:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getLatestPriceByTickerIdController = async (req: Request, res: Response) => {
  try {
    const { tickerId } = req.params;
    
    // Ensure tickerId is a string
    const tickerIdStr = Array.isArray(tickerId) ? tickerId[0] : tickerId;
    
    const { message, data } = await getLatestPriceByTickerId(tickerIdStr);
    
    if (!data) {
      return res.status(404).json({ message });
    }
    
    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.error("Error fetching latest price:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getDailyPricesByDateController = async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    
    // Ensure date is a string
    const dateStr = Array.isArray(date) ? date[0] : date;
    
    if (!dateStr) {
      return res.status(400).json({ message: "Date parameter is required" });
    }
    
    const { message, data } = await getDailyPricesByDate(dateStr);
    
    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.error("Error fetching daily prices by date:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const bulkUpdateDailyPricesController = async (req: Request, res: Response) => {
  try {
    const { prices } = req.body;
    
    if (!prices || !Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ 
        message: "Prices array is required and cannot be empty" 
      });
    }
    
    // Validate each price object
    for (const price of prices) {
      if (!price.tickerId || !price.date || !price.price) {
        return res.status(400).json({ 
          message: "Each price object must contain tickerId, date, and price" 
        });
      }
    }
    
    const { message, data } = await bulkUpdateDailyPrices(prices);
    
    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.error("Error bulk updating daily prices:", error);
    return res.status(500).json({ message: error.message });
  }
};
