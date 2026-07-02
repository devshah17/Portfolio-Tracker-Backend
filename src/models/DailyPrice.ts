import mongoose from "mongoose";

const dailyPriceSchema = new mongoose.Schema(
  {
    tickerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticker",
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    price: {
      type: Number,
      required: true,
    },
    exchangeRate: {
      type: Number,
      default: 1,
    },
    trailingPE: { type: Number },
    forwardPE: { type: Number },
    epsTrailingTwelveMonths: { type: Number },
    epsForward: { type: Number },
    priceToBook: { type: Number },
    marketCap: { type: Number },
    dividendYield: { type: Number },
    trailingAnnualDividendYield: { type: Number },
    fiftyDayAverage: { type: Number },
    twoHundredDayAverage: { type: Number },
    fiftyTwoWeekHigh: { type: Number },
    fiftyTwoWeekLow: { type: Number },
    regularMarketVolume: { type: Number },
    averageDailyVolume3Month: { type: Number },
    averageAnalystRating: { type: String },
  },
  {
    timestamps: true,
  },
);

// We want to be able to quickly find the latest price for a ticker
dailyPriceSchema.index({ tickerId: 1, date: -1 });

// Enforce one record per ticker per day
dailyPriceSchema.index({ tickerId: 1, date: 1 }, { unique: true });

const DailyPrice = mongoose.model("DailyPrice", dailyPriceSchema);

export default DailyPrice;
