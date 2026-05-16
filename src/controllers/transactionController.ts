import { Request, Response } from "express";
import * as transactionService from "../services/transactionServices.js";

export const addTransactionController = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { tickerId, type, date, quantity, price, exchangeRate } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const txn = await transactionService.addTransaction(
      userId as string,
      tickerId,
      type,
      new Date(date),
      Number(quantity),
      Number(price),
      Number(exchangeRate || 1)
    );

    res.status(201).json({ success: true, message: "Transaction added successfully", data: txn });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTransactionController = async (req: Request, res: Response) => {
  try {
    const { userId, txnId } = req.params;

    if (!userId || !txnId) {
      return res.status(400).json({ success: false, message: "User ID and Transaction ID are required" });
    }

    await transactionService.deleteTransaction(userId as string, txnId as string);

    res.status(200).json({ success: true, message: "Transaction deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTransactionController = async (req: Request, res: Response) => {
  try {
    const { userId, txnId } = req.params;
    const { tickerId, type, date, quantity, price, exchangeRate } = req.body;

    if (!userId || !txnId) {
      return res.status(400).json({ success: false, message: "User ID and Transaction ID are required" });
    }

    const updateData: any = {};
    if (tickerId) updateData.tickerId = tickerId;
    if (type) updateData.type = type;
    if (date) updateData.date = new Date(date);
    if (quantity) updateData.quantity = Number(quantity);
    if (price) updateData.price = Number(price);
    if (exchangeRate) updateData.exchangeRate = Number(exchangeRate);

    const txn = await transactionService.updateTransaction(userId as string, txnId as string, updateData);

    res.status(200).json({ success: true, message: "Transaction updated successfully", data: txn });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTransactionStatsController = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { fy } = req.query; // e.g. ?fy=2023-2024

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const stats = await transactionService.getTransactionStats(userId as string, fy as string);

    res.status(200).json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
