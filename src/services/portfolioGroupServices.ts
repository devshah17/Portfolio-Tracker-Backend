import mongoose from "mongoose";
import PortfolioGroup from "../models/PortfolioGroup.js";
import PortfolioEntry from "../models/PortfolioEntry.js";
import PortfolioItem from "../models/PortfolioItem.js";

type ServiceResult<T = any> = {
  message: string;
  data: T | null;
};

// ── helpers ──────────────────────────────────────────────────────────────────

// ── portfolio group CRUD ──────────────────────────────────────────────────────

export const createPortfolioGroup = async (
  userId: string,
  name: string
): Promise<ServiceResult> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { message: "Invalid user ID", data: null };
    }
    const group = await PortfolioGroup.create({ name, user: userId });
    return { message: "Portfolio created successfully", data: group };
  } catch (error) {
    console.log("Error creating portfolio group:", error);
    return { message: "Failed to create portfolio", data: null };
  }
};

export const getUserPortfolioGroups = async (
  userId: string
): Promise<ServiceResult<any[]>> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { message: "Invalid user ID", data: null };
    }
    const groups = await PortfolioGroup.find({ user: userId }).sort({ createdAt: 1 });
    return { message: "Portfolio groups fetched", data: groups };
  } catch (error) {
    console.log("Error fetching portfolio groups:", error);
    return { message: "Failed to fetch portfolios", data: null };
  }
};

export const deletePortfolioGroup = async (
  groupId: string
): Promise<ServiceResult> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return { message: "Invalid group ID", data: null };
    }
    const group = await PortfolioGroup.findByIdAndDelete(groupId);
    if (!group) return { message: "Portfolio not found", data: null };
    // clean up entries
    await PortfolioEntry.deleteMany({ portfolioGroup: groupId });
    return { message: "Portfolio deleted successfully", data: null };
  } catch (error) {
    console.log("Error deleting portfolio group:", error);
    return { message: "Failed to delete portfolio", data: null };
  }
};

// ── entries (assets inside a group) ──────────────────────────────────────────

import DailyPrice from "../models/DailyPrice.js";

export const getGroupItems = async (
  groupId: string,
  userId: string
): Promise<ServiceResult<any[]>> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return { message: "Invalid group ID", data: null };
    }

    const entries = await PortfolioEntry.find({ portfolioGroup: groupId }).populate({
      path: "portfolioItem",
      populate: { path: "ticker" },
    });

    const items = entries
      .map((e) => e.portfolioItem as any)
      .filter((item) => item && item.user?.toString() === userId);

    // Merge with latest prices from database
    const merged = await Promise.all(
      items.map(async (item) => {
        const t = item.ticker as any;
        const latestPrice = await DailyPrice.findOne({ tickerId: t?._id }).sort({ date: -1 });
        
        return {
          ...item.toObject(),
          tickerDetails: t,
          currentPrice: latestPrice ? latestPrice.price : null,
          currentExchangeRate: latestPrice ? latestPrice.exchangeRate : 1,
          exchangeRate: item.exchangeRate || 1,
          priceError: latestPrice ? null : "No price data found in database",
        };
      })
    );

    return { message: "Group items fetched", data: merged };
  } catch (error) {
    console.log("Error fetching group items:", error);
    return { message: "Failed to fetch group items", data: null };
  }
};

export const addEntryToGroup = async (
  groupId: string,
  portfolioItemId: string
): Promise<ServiceResult> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(portfolioItemId)) {
      return { message: "Invalid ID", data: null };
    }

    const item = await PortfolioItem.findById(portfolioItemId);
    if (!item) return { message: "Asset not found", data: null };

    const group = await PortfolioGroup.findById(groupId);
    if (!group) return { message: "Portfolio not found", data: null };

    const existing = await PortfolioEntry.findOne({
      portfolioGroup: groupId,
      portfolioItem: portfolioItemId,
    });
    if (existing) return { message: "Asset already in this portfolio", data: null };

    const entry = await PortfolioEntry.create({
      portfolioGroup: groupId,
      portfolioItem: portfolioItemId,
    });
    return { message: "Asset added to portfolio", data: entry };
  } catch (error) {
    console.log("Error adding entry to group:", error);
    return { message: "Failed to add asset to portfolio", data: null };
  }
};

export const removeEntryFromGroup = async (
  groupId: string,
  portfolioItemId: string
): Promise<ServiceResult> => {
  try {
    const result = await PortfolioEntry.findOneAndDelete({
      portfolioGroup: groupId,
      portfolioItem: portfolioItemId,
    });
    if (!result) return { message: "Entry not found", data: null };
    return { message: "Asset removed from portfolio", data: null };
  } catch (error) {
    console.log("Error removing entry from group:", error);
    return { message: "Failed to remove asset from portfolio", data: null };
  }
};
