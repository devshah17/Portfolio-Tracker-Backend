import mongoose from "mongoose";
import Ticker, { TickerType } from "../models/Ticker";

type ServiceResult<T = any> = {
  message: string;
  data: T | null;
};

type CreateTickerInput = {
  name: string;
  tickerName: string;
  type: TickerType;
  currency: string;
  market: string;
};

const validateTicker = (data: any): ServiceResult => {
  if (!data.name || typeof data.name !== "string") {
    return { message: "Name is required and must be a string", data: null };
  }
  if (!data.tickerName || typeof data.tickerName !== "string") {
    return {
      message: "Ticker name is required and must be a string",
      data: null,
    };
  }
  if (!data.type || (data.type !== "Stock" && data.type !== "MF")) {
    return { message: "Type must be either 'Stock' or 'MF'", data: null };
  }
  if (!data.currency || typeof data.currency !== "string") {
    return {
      message: "Currency is required and must be a string",
      data: null,
    };
  }
  if (!data.market || typeof data.market !== "string") {
    return {
      message: "Market is required and must be a string",
      data: null,
    };
  }
  return { message: "Ticker is valid", data };
};

export const createTicker = async (
  data: CreateTickerInput,
): Promise<ServiceResult<any>> => {
  try {
    const validation = validateTicker(data);
    if (validation.message !== "Ticker is valid") {
      return { message: validation.message, data: null };
    }

    const existing = await Ticker.findOne({ tickerName: data.tickerName });
    if (existing) {
      return { message: "Ticker with this tickerName already exists", data: null };
    }

    const ticker = await Ticker.create(data);
    return { message: "Ticker created successfully", data: ticker };
  } catch (error) {
    console.log("Error creating ticker:", error);
    return { message: "Failed to create ticker", data: null };
  }
};

export const getAllTickers = async (): Promise<ServiceResult<any[]>> => {
  try {
    const tickers = await Ticker.find().sort({ createdAt: -1 });
    return { message: "Tickers fetched successfully", data: tickers };
  } catch (error) {
    console.log("Error fetching tickers:", error);
    return { message: "Failed to fetch tickers", data: null };
  }
};

export const getTickerById = async (
  id: string,
): Promise<ServiceResult<any>> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { message: "Invalid ticker ID", data: null };
    }

    const ticker = await Ticker.findById(id);
    if (!ticker) {
      return { message: "Ticker not found", data: null };
    }

    return { message: "Ticker fetched successfully", data: ticker };
  } catch (error) {
    console.log("Error fetching ticker:", error);
    return { message: "Failed to fetch ticker", data: null };
  }
};

export const updateTicker = async (
  id: string,
  updates: Partial<CreateTickerInput>,
): Promise<ServiceResult<any>> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { message: "Invalid ticker ID", data: null };
    }

    const ticker = await Ticker.findById(id);
    if (!ticker) {
      return { message: "Ticker not found", data: null };
    }

    if (updates.type && updates.type !== "Stock" && updates.type !== "MF") {
      return { message: "Type must be either 'Stock' or 'MF'", data: null };
    }

    if (
      updates.currency !== undefined &&
      typeof updates.currency !== "string"
    ) {
      return {
        message: "Currency must be a string",
        data: null,
      };
    }

    if (updates.market !== undefined && typeof updates.market !== "string") {
      return {
        message: "Market must be a string",
        data: null,
      };
    }

    if (updates.tickerName && updates.tickerName !== ticker.tickerName) {
      const existing = await Ticker.findOne({
        tickerName: updates.tickerName,
        _id: { $ne: id },
      });
      if (existing) {
        return { message: "Ticker with this tickerName already exists", data: null };
      }
    }

    const allowedFields: (keyof CreateTickerInput)[] = [
      "name",
      "tickerName",
      "type",
      "currency",
      "market",
    ];
    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        (ticker as any)[field] = updates[field];
      }
    });

    await ticker.save();
    return { message: "Ticker updated successfully", data: ticker };
  } catch (error) {
    console.log("Error updating ticker:", error);
    return { message: "Failed to update ticker", data: null };
  }
};

export const deleteTicker = async (
  id: string,
): Promise<ServiceResult<null>> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { message: "Invalid ticker ID", data: null };
    }

    const result = await Ticker.findByIdAndDelete(id);
    if (!result) {
      return { message: "Ticker not found", data: null };
    }

    return { message: "Ticker deleted successfully", data: null };
  } catch (error) {
    console.log("Error deleting ticker:", error);
    return { message: "Failed to delete ticker", data: null };
  }
};

