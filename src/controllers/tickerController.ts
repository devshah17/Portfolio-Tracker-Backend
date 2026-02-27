import { Request, Response } from "express";
import {
  createTicker,
  deleteTicker,
  getAllTickers,
  getTickerById,
  updateTicker,
} from "../services/tickerServices";

export const createTickerController = async (req: Request, res: Response) => {
  try {
    const { message, data } = await createTicker(req.body);

    if (message !== "Ticker created successfully") {
      return res.status(400).json({ message });
    }

    return res.status(201).json({ message, data });
  } catch (error: any) {
    console.log("Error creating ticker:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getAllTickersController = async (req: Request, res: Response) => {
  try {
    const { message, data } = await getAllTickers();

    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.log("Error fetching tickers:", error);
    return res.status(500).json({ message: error.message });
  }
};

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