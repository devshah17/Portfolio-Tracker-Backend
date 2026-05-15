import { Request, Response } from "express";
import {
  createPortfolioGroup,
  getUserPortfolioGroups,
  deletePortfolioGroup,
  getGroupItems,
  addEntryToGroup,
  removeEntryFromGroup,
} from "../services/portfolioGroupServices";

export const createPortfolioGroupController = async (req: Request, res: Response) => {
  try {
    const { userId, name } = req.body;
    if (!userId || !name) {
      return res.status(400).json({ message: "userId and name are required" });
    }
    const { message, data } = await createPortfolioGroup(userId, name);
    if (message !== "Portfolio created successfully") return res.status(400).json({ message });
    return res.status(201).json({ message, data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getUserPortfolioGroupsController = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const { message, data } = await getUserPortfolioGroups(userId);
    if (message === "Invalid user ID") return res.status(400).json({ message });
    return res.status(200).json({ message, data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const deletePortfolioGroupController = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { message } = await deletePortfolioGroup(id);
    if (message === "Invalid group ID") return res.status(400).json({ message });
    if (message === "Portfolio not found") return res.status(404).json({ message });
    if (message !== "Portfolio deleted successfully") return res.status(400).json({ message });
    return res.status(200).json({ message });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getGroupItemsController = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ message: "userId query param is required" });
    const { message, data } = await getGroupItems(id, userId);
    if (message === "Invalid group ID") return res.status(400).json({ message });
    return res.status(200).json({ message, data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const addEntryToGroupController = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { portfolioItemId } = req.body;
    if (!portfolioItemId) return res.status(400).json({ message: "portfolioItemId is required" });
    const { message, data } = await addEntryToGroup(id, portfolioItemId as string);
    if (message === "Asset already in this portfolio") return res.status(409).json({ message });
    if (message !== "Asset added to portfolio") return res.status(400).json({ message });
    return res.status(201).json({ message, data });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const removeEntryFromGroupController = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const portfolioItemId = req.params.portfolioItemId as string;
    const { message } = await removeEntryFromGroup(id, portfolioItemId);
    if (message === "Entry not found") return res.status(404).json({ message });
    if (message !== "Asset removed from portfolio") return res.status(400).json({ message });
    return res.status(200).json({ message });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
