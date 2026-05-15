import mongoose from "mongoose";
import Transaction from "../models/Transaction";
import DailyPrice from "../models/DailyPrice";
import Ticker from "../models/Ticker";
import { syncPortfolioFromTransactions } from "./syncServices";
import { buildLatestPriceMaps, currentValueINR } from "../utils/plCalculations";

function getFinancialYear(d: Date): string {
  const month = d.getMonth(); // 0-indexed (0 = Jan, 3 = Apr)
  const year = d.getFullYear();
  if (month >= 3) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

export const addTransaction = async (
  userId: string,
  tickerId: string,
  type: "BUY" | "SELL",
  date: Date,
  quantity: number,
  price: number,
  exchangeRate: number = 1
) => {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(tickerId)) {
    throw new Error("Invalid userId or tickerId");
  }

  const ticker = await Ticker.findById(tickerId);
  if (!ticker) {
    throw new Error("Ticker not found");
  }

  const txn = await Transaction.create({
    user: userId,
    ticker: tickerId,
    type,
    date,
    quantity,
    price,
    exchangeRate,
  });

  await syncPortfolioFromTransactions(userId);

  return txn;
};

export const deleteTransaction = async (userId: string, txnId: string) => {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(txnId)) {
    throw new Error("Invalid userId or txnId");
  }
  const txn = await Transaction.findOneAndDelete({ _id: txnId, user: userId });
  if (!txn) {
    throw new Error("Transaction not found");
  }

  await syncPortfolioFromTransactions(userId);

  return txn;
};

export const updateTransaction = async (
  userId: string,
  txnId: string,
  data: {
    tickerId?: string;
    type?: "BUY" | "SELL";
    date?: Date;
    quantity?: number;
    price?: number;
    exchangeRate?: number;
  }
) => {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(txnId)) {
    throw new Error("Invalid userId or txnId");
  }

  // Validate ticker if it's being updated
  if (data.tickerId) {
    if (!mongoose.Types.ObjectId.isValid(data.tickerId)) {
      throw new Error("Invalid tickerId");
    }
    const ticker = await Ticker.findById(data.tickerId);
    if (!ticker) throw new Error("Ticker not found");
  }

  const txn = await Transaction.findOneAndUpdate(
    { _id: txnId, user: userId },
    { $set: data },
    { new: true }
  );

  if (!txn) {
    throw new Error("Transaction not found");
  }

  await syncPortfolioFromTransactions(userId);

  return txn;
};

export const getTransactionStats = async (userId: string, fyFilter?: string) => {
  const txns = await Transaction.find({ user: userId }).populate("ticker").sort({ date: 1 });

  // Group by ticker ID
  const txnsByTicker: Record<string, any[]> = {};
  for (const t of txns) {
    const tid = t.ticker._id.toString();
    if (!txnsByTicker[tid]) txnsByTicker[tid] = [];
    txnsByTicker[tid].push(t);
  }

  // Find latest prices
  const validTickerIds = Object.keys(txnsByTicker);
  const latestPrices = validTickerIds.length > 0
    ? await DailyPrice.find({ tickerId: { $in: validTickerIds } }).sort({ date: -1 })
    : [];

  const { priceMap } = buildLatestPriceMaps(latestPrices);

  let totalRealisedGain = 0;
  let totalUnrealisedGain = 0;
  let totalInvested = 0;
  let totalCurrentValue = 0;

  const fyList = new Set<string>();

  // For each ticker, compute FIFO
  for (const tid of validTickerIds) {
    const tTxns = txnsByTicker[tid];
    const buyLots: { quantity: number; price: number; exchangeRate: number }[] = [];
    
    for (const txn of tTxns) {
      const fy = getFinancialYear(new Date(txn.date));
      fyList.add(fy);

      if (txn.type === "BUY") {
        buyLots.push({
          quantity: txn.quantity,
          price: txn.price,
          exchangeRate: txn.exchangeRate || 1,
        });
      } else if (txn.type === "SELL") {
        let remainingToSell = txn.quantity;
        while (remainingToSell > 0 && buyLots.length > 0) {
          const lot = buyLots[0];
          const consumeQty = Math.min(lot.quantity, remainingToSell);

          const buyValue = consumeQty * lot.price * lot.exchangeRate;
          const sellValue = consumeQty * txn.price * (txn.exchangeRate || 1);
          const profit = sellValue - buyValue;

          // Add to realised gain if it matches the filter (or if no filter is applied/ALL is selected)
          if (!fyFilter || fyFilter === "ALL" || fyFilter === fy) {
            totalRealisedGain += profit;
          }

          lot.quantity -= consumeQty;
          remainingToSell -= consumeQty;

          if (lot.quantity === 0) {
            buyLots.shift();
          }
        }
      }
    }

    // Remaining buyLots represent current holdings for this ticker
    let remainingQty = 0;
    let investedValue = 0;
    for (const lot of buyLots) {
      remainingQty += lot.quantity;
      investedValue += lot.quantity * lot.price * lot.exchangeRate;
    }

    if (remainingQty > 0) {
      totalInvested += investedValue;

      // Calculate averages to use as safe fallbacks that produce 0 unrealised P&L
      let totalNative = 0;
      for (const lot of buyLots) {
        totalNative += lot.quantity * lot.price;
      }
      const avgHistoricalNativePrice = totalNative / remainingQty;
      const avgHistoricalRate = investedValue / totalNative;

      const curValue = currentValueINR(
        priceMap[tid] ?? null,
        avgHistoricalNativePrice,
        avgHistoricalRate,
        remainingQty
      );
      totalCurrentValue += curValue;

      // Unrealised gain is always for current holdings, independent of FY filter
      totalUnrealisedGain += curValue - investedValue;
    }
  }

  // Sort txns descending for display
  const displayTxns = [...txns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    transactions: displayTxns,
    stats: {
      totalRealisedGain,
      totalUnrealisedGain,
      totalInvested,
      totalCurrentValue,
    },
    availableFYs: Array.from(fyList).sort().reverse(),
  };
};
