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
    },
    price: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      { tickerId: 1, date: -1 }, // For querying latest prices for a ticker
      { date: -1 }, // For querying all prices by date
      { tickerId: 1, date: 1 }, // Unique constraint for ticker and date
    ],
  }
);

// Create a compound index to ensure unique ticker-date combination
dailyPriceSchema.index({ tickerId: 1, date: 1 }, { unique: true });

const DailyPrice = mongoose.model("DailyPrice", dailyPriceSchema);

export default DailyPrice;
