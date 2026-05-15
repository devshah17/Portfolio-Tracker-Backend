import mongoose from "mongoose";
import Transaction from "../models/Transaction";
import PortfolioItem from "../models/PortfolioItem";

export const syncPortfolioFromTransactions = async (userId: string) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID");
  }

  // 1. Fetch all transactions for this user, sorted chronologically
  const txns = await Transaction.find({ user: userId }).sort({ date: 1 });

  // 2. Group by tickerId
  const txnsByTicker: Record<string, any[]> = {};
  for (const t of txns) {
    const tid = t.ticker.toString();
    if (!txnsByTicker[tid]) txnsByTicker[tid] = [];
    txnsByTicker[tid].push(t);
  }

  // 3. For each ticker, compute remaining lots using FIFO
  const activeTickers = new Set<string>();

  for (const [tid, tTxns] of Object.entries(txnsByTicker)) {
    const buyLots: { quantity: number; price: number; exchangeRate: number }[] = [];

    for (const txn of tTxns) {
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
          
          lot.quantity -= consumeQty;
          remainingToSell -= consumeQty;

          if (lot.quantity === 0) {
            buyLots.shift();
          }
        }
      }
    }

    let remainingQty = 0;
    let totalInvestedValueNative = 0;
    let totalInvestedValueINR = 0;

    for (const lot of buyLots) {
      remainingQty += lot.quantity;
      totalInvestedValueNative += lot.quantity * lot.price;
      totalInvestedValueINR += lot.quantity * lot.price * (lot.exchangeRate || 1);
    }

    if (remainingQty > 0) {
      activeTickers.add(tid);
      const avgBuyPriceNative = totalInvestedValueNative / remainingQty;
      const avgExchangeRate = totalInvestedValueNative > 0 ? (totalInvestedValueINR / totalInvestedValueNative) : 1;

      // Upsert into PortfolioItem
      await PortfolioItem.findOneAndUpdate(
        { user: userId, ticker: tid },
        { 
          $set: { 
            quantity: remainingQty, 
            buyingPrice: avgBuyPriceNative,
            exchangeRate: avgExchangeRate
          } 
        },
        { upsert: true, new: true }
      );
    } else {
      // Quantity is 0, delete if exists
      await PortfolioItem.findOneAndDelete({ user: userId, ticker: tid });
    }
  }

  // 4. Delete any PortfolioItems for this user that no longer have ANY corresponding transactions 
  // (e.g. if the user deleted all transactions for a ticker)
  await PortfolioItem.deleteMany({
    user: userId,
    ticker: { $nin: Array.from(activeTickers) }
  });

  return true;
};
