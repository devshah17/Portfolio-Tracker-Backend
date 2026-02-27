import DailyPrice from "../models/DailyPrice";
import Ticker from "../models/Ticker";

export const createDailyPrices = async (prices: any[]) => {
  try {
    const result = await DailyPrice.insertMany(prices, { 
      ordered: false, // Continue inserting even if some fail
      rawResult: true 
    });
    
    return {
      message: "Daily prices created successfully",
      data: result,
      count: Array.isArray(result) ? result.length : result.insertedCount || 0
    };
  } catch (error: any) {
    if (error.code === 11000) {
      // Duplicate key error
      return {
        message: "Some daily prices already exist",
        error: "Duplicate entries found",
        data: null
      };
    }
    throw error;
  }
};

export const getDailyPricesByTickerId = async (tickerId: string, limit?: number) => {
  try {
    const query = DailyPrice.find({ tickerId }).sort({ date: -1 }).populate('tickerId', 'name tickerName type currency market');
    
    if (limit) {
      query.limit(limit);
    }
    
    const prices = await query.exec();
    
    return {
      message: "Daily prices retrieved successfully",
      data: prices
    };
  } catch (error: any) {
    throw new Error(`Error retrieving daily prices: ${error.message}`);
  }
};

export const getLatestPriceByTickerId = async (tickerId: string) => {
  try {
    const latestPrice = await DailyPrice.findOne({ tickerId })
      .sort({ date: -1 })
      .populate('tickerId', 'name tickerName type currency market')
      .exec();
    
    if (!latestPrice) {
      return {
        message: "No price data found for this ticker",
        data: null
      };
    }
    
    return {
      message: "Latest price retrieved successfully",
      data: latestPrice
    };
  } catch (error: any) {
    throw new Error(`Error retrieving latest price: ${error.message}`);
  }
};

export const getDailyPricesByDate = async (date: string) => {
  try {
    const targetDate = new Date(date);
    const prices = await DailyPrice.find({ 
      date: {
        $gte: targetDate,
        $lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
      }
    }).populate('tickerId', 'name tickerName type currency market').exec();
    
    return {
      message: "Daily prices for date retrieved successfully",
      data: prices
    };
  } catch (error: any) {
    throw new Error(`Error retrieving daily prices by date: ${error.message}`);
  }
};

export const bulkUpdateDailyPrices = async (updates: any[]) => {
  try {
    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { tickerId: update.tickerId, date: update.date },
        update: { $set: update },
        upsert: true
      }
    }));
    
    const result = await DailyPrice.bulkWrite(bulkOps);
    
    return {
      message: "Daily prices updated successfully",
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount,
        insertedCount: result.insertedCount
      }
    };
  } catch (error: any) {
    throw new Error(`Error bulk updating daily prices: ${error.message}`);
  }
};
