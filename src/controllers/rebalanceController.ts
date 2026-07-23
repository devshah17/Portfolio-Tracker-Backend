import { Request, Response } from "express";
import User from "../models/User.js";
import PortfolioEntry from "../models/PortfolioEntry.js";
import DailyPrice from "../models/DailyPrice.js";
import Ticker from "../models/Ticker.js";

export const getRebalanceData = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);

        if (!user) {
            res.status(404).json({ success: false, error: "User not found" });
            return;
        }

        const targetAllocationsMap = user.targetAllocations || new Map();
        // Convert to a plain object
        const targetAllocations: Record<string, number> = {};
        for (const [key, value] of targetAllocationsMap.entries()) {
            targetAllocations[key] = value as number;
        }

        const assets = await PortfolioEntry.find({ user: userId }).populate("ticker");
        
        let totalValue = 0;
        const currentAllocations: Record<string, number> = {};
        const assetBreakdown: Record<string, any[]> = {};

        for (const asset of assets) {
            const ticker = (asset as any).ticker as any;
            if (!ticker) continue;
            
            const category = `${ticker.market} ${ticker.type}`; // e.g., "Indian Stock", "US MF"
            
            // Get latest DailyPrice for this ticker
            const latestPrice = await DailyPrice.findOne({ tickerId: ticker._id })
                                                .sort({ date: -1 });
            
            // Fallback to buying price if no daily price found
            const currentPrice = latestPrice ? latestPrice.price : (asset as any).buyingPrice;
            const exchangeRate = latestPrice && latestPrice.exchangeRate ? latestPrice.exchangeRate : ((asset as any).exchangeRate || 1);
            
            // Value in INR
            const valueINR = currentPrice * (asset as any).quantity * exchangeRate;
            
            totalValue += valueINR;
            currentAllocations[category] = (currentAllocations[category] || 0) + valueINR;

            if (!assetBreakdown[category]) {
                assetBreakdown[category] = [];
            }
            assetBreakdown[category].push({
                tickerName: ticker.tickerName,
                name: ticker.name,
                value: valueINR,
                quantity: (asset as any).quantity,
                price: currentPrice
            });
        }

        // Compute percentages and action plan
        const actionPlan = [];
        const currentPercentages: Record<string, number> = {};

        // Merge keys from currentAllocations and targetAllocations
        const allCategories = new Set([...Object.keys(currentAllocations), ...Object.keys(targetAllocations)]);

        for (const category of allCategories) {
            const currentVal = currentAllocations[category] || 0;
            const currentPct = totalValue > 0 ? (currentVal / totalValue) * 100 : 0;
            currentPercentages[category] = currentPct;

            const targetPct = targetAllocations[category] || 0;
            const targetVal = (targetPct / 100) * totalValue;
            const diffVal = targetVal - currentVal;

            if (Math.abs(diffVal) > 1) { // Ignore minor rounding differences
                actionPlan.push({
                    category,
                    action: diffVal > 0 ? "BUY" : "SELL",
                    amount: Math.abs(diffVal),
                    currentPct,
                    targetPct,
                    currentVal,
                    targetVal
                });
            }
        }

        // Sort action plan by absolute amount (biggest actions first)
        actionPlan.sort((a, b) => b.amount - a.amount);

        res.status(200).json({
            success: true,
            data: {
                totalValue,
                currentAllocations: currentPercentages,
                currentValues: currentAllocations,
                targetAllocations,
                actionPlan,
                assetBreakdown
            }
        });

    } catch (error) {
        console.error("Error generating rebalance data:", error);
        res.status(500).json({ success: false, error: "Server error" });
    }
};

export const updateTargetAllocations = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const { targetAllocations } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ success: false, error: "User not found" });
            return;
        }

        // Validate that allocations sum to ~100
        let sum = 0;
        for (const key in targetAllocations) {
            sum += targetAllocations[key];
        }

        if (Math.abs(sum - 100) > 0.1 && sum !== 0) {
            res.status(400).json({ success: false, error: "Target allocations must sum to 100%" });
            return;
        }

        user.targetAllocations = targetAllocations;
        await user.save();

        res.status(200).json({ success: true, message: "Target allocations updated successfully", data: user.targetAllocations });
    } catch (error) {
        console.error("Error updating target allocations:", error);
        res.status(500).json({ success: false, error: "Server error" });
    }
};
