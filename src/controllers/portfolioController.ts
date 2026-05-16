import { Request, Response } from "express";
import {
  addPortfolioItem,
  getUserPortfolio,
  deletePortfolioItem,
  updatePortfolioItem,
} from "../services/portfolioServices.js";

export const addPortfolioItemController = async (req: Request, res: Response) => {
  try {
    const { userId, tickerId, buyingPrice, quantity, exchangeRate } = req.body;
    
    if (!userId || !tickerId || buyingPrice === undefined) {
      return res.status(400).json({ message: "userId, tickerId, and buyingPrice are required" });
    }

    const qty = quantity !== undefined ? Number(quantity) : 1;
    const price = Number(buyingPrice);
    const rate = exchangeRate !== undefined ? Number(exchangeRate) : 1;

    const { message, data } = await addPortfolioItem(userId, tickerId, price, qty, rate);

    if (message !== "Portfolio item added successfully") {
      return res.status(400).json({ message });
    }

    return res.status(201).json({ message, data });
  } catch (error: any) {
    console.log("Error adding portfolio item:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getUserPortfolioController = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const { message, data } = await getUserPortfolio(userId);

    if (message === "Invalid user ID") {
      return res.status(400).json({ message });
    }

    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.log("Error fetching portfolio:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const updatePortfolioItemController = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { buyingPrice, quantity, exchangeRate } = req.body;

    if (buyingPrice === undefined || quantity === undefined) {
      return res.status(400).json({ message: "buyingPrice and quantity are required" });
    }

    const rate = exchangeRate !== undefined ? Number(exchangeRate) : 1;
    const { message, data } = await updatePortfolioItem(id, Number(buyingPrice), Number(quantity), rate);

    if (message === "Invalid item ID") return res.status(400).json({ message });
    if (message === "Portfolio item not found") return res.status(404).json({ message });
    if (message !== "Portfolio item updated successfully") return res.status(400).json({ message });

    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.log("Error updating portfolio item:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const deletePortfolioItemController = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { message } = await deletePortfolioItem(id);

    if (message === "Invalid item ID") {
      return res.status(400).json({ message });
    }

    if (message === "Portfolio item not found") {
      return res.status(404).json({ message });
    }

    return res.status(200).json({ message });
  } catch (error: any) {
    console.log("Error deleting portfolio item:", error);
    return res.status(500).json({ message: error.message });
  }
};
