import { Request, Response } from "express";
import {
  deleteTicker,
  getTickerById,
  updateTicker,
} from "../services/tickerServices";

export const getTickerByIdController = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { message, data } = await getTickerById(id);

    if (message === "Invalid ticker ID") {
      return res.status(400).json({ message });
    }

    if (message === "Ticker not found") {
      return res.status(404).json({ message });
    }

    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.log("Error fetching ticker:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateTickerController = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { message, data } = await updateTicker(id, req.body);

    if (message === "Invalid ticker ID") {
      return res.status(400).json({ message });
    }

    if (message === "Ticker not found") {
      return res.status(404).json({ message });
    }

    if (message !== "Ticker updated successfully") {
      return res.status(400).json({ message });
    }

    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.log("Error updating ticker:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const deleteTickerController = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { message } = await deleteTicker(id);

    if (message === "Invalid ticker ID") {
      return res.status(400).json({ message });
    }

    if (message === "Ticker not found") {
      return res.status(404).json({ message });
    }

    if (message !== "Ticker deleted successfully") {
      return res.status(400).json({ message });
    }

    return res.status(200).json({ message });
  } catch (error: any) {
    console.log("Error deleting ticker:", error);
    return res.status(500).json({ message: error.message });
  }
};