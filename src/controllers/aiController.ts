import { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import YahooFinance from "yahoo-finance2";
import Ticker from "../models/Ticker.js";
import DailyPrice from "../models/DailyPrice.js";
import PortfolioItem from "../models/PortfolioItem.js";
import PortfolioEntry from "../models/PortfolioEntry.js";
import {
  buildLatestPriceMaps,
  currentValueINR,
  investmentINR,
  unrealisedPLPercent,
} from "../utils/plCalculations.js";

const yahooFinance = new YahooFinance();

export const queryInvestmentAnalyst = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { ticker } = req.body;
    const userId = (req as any).user?.userId;

    if (!ticker) {
      res.status(400).json({ success: false, error: "ticker is required" });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        success: false,
        error: "Gemini API key is missing in environment variables",
      });
      return;
    }

    // ── 1. Resolve ticker document from DB ──────────────────────────────────
    const tickerDoc = await Ticker.findOne({ tickerName: ticker });

    // ── 2. Fetch last 2 daily price records from DB ──────────────────────────
    let todayPrice: any = null;
    let yesterdayPrice: any = null;
    if (tickerDoc) {
      const recentPrices = await DailyPrice.find({ tickerId: tickerDoc._id })
        .sort({ date: -1 })
        .limit(2)
        .lean();
      todayPrice = recentPrices[0] ?? null;
      yesterdayPrice = recentPrices[1] ?? null;
    }

    // ── 3. Fetch user's portfolio holding for this ticker ───────────────────
    let userHolding: any = null;
    if (userId && tickerDoc) {
      userHolding = await PortfolioItem.findOne({
        user: userId,
        ticker: tickerDoc._id,
      }).lean();
    }

    // ── 4. Fetch live quote from Yahoo Finance ───────────────────────────────
    let liveQuote: any = null;
    try {
      liveQuote = (await yahooFinance.quote(ticker as string)) as any;
    } catch (err) {
      console.warn(`Could not fetch live quote for ${ticker}`);
    }

    // ── 5. Fetch recent news from Yahoo Finance ──────────────────────────────
    let newsHeadlines: string[] = [];
    try {
      const searchRes = await yahooFinance.search(ticker, { newsCount: 5 });
      if (searchRes.news && searchRes.news.length > 0) {
        newsHeadlines = searchRes.news.map((n: any) => `• ${n.title}`);
      }
    } catch (err) {
      console.warn(`Could not fetch news for ${ticker}`);
    }

    // ── 6. Build derived context values ─────────────────────────────────────
    const currentPrice =
      liveQuote?.regularMarketPrice ?? todayPrice?.price ?? "N/A";
    const prevClose =
      liveQuote?.regularMarketPreviousClose ?? yesterdayPrice?.price ?? "N/A";
    const dailyChange =
      currentPrice !== "N/A" && prevClose !== "N/A"
        ? (((currentPrice - prevClose) / prevClose) * 100).toFixed(2) + "%"
        : "N/A";

    const qty = userHolding?.quantity ?? 0;
    const buyPrice = userHolding?.buyingPrice ?? "N/A";
    const holdingValue =
      qty && currentPrice !== "N/A" ? (qty * currentPrice).toFixed(2) : "N/A";
    const unrealizedPnL =
      qty && currentPrice !== "N/A" && buyPrice !== "N/A"
        ? ((currentPrice - buyPrice) * qty).toFixed(2)
        : "N/A";
    const pnlPercent =
      buyPrice !== "N/A" && currentPrice !== "N/A"
        ? (((currentPrice - buyPrice) / buyPrice) * 100).toFixed(2) + "%"
        : "N/A";

    // ── 7. Build the mega-prompt ─────────────────────────────────────────────
    const prompt = `
You are a seasoned value and growth investor with 20+ years of active market experience, deeply influenced by the philosophies of Warren Buffett, Peter Lynch, and Charlie Munger. You study price action, market sentiment, fundamental valuations, and macro trends simultaneously.

Analyse the following asset comprehensively and return a structured JSON investment recommendation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ASSET: ${ticker} (${tickerDoc?.name ?? "Unknown"}) | Type: ${tickerDoc?.type ?? "N/A"} | Market: ${tickerDoc?.market ?? "N/A"} | Currency: ${tickerDoc?.currency ?? "N/A"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ LIVE MARKET DATA
  Current Price         : ${currentPrice}
  Previous Close        : ${prevClose}
  Daily Change          : ${dailyChange}
  52-Week High          : ${liveQuote?.fiftyTwoWeekHigh ?? todayPrice?.fiftyTwoWeekHigh ?? "N/A"}
  52-Week Low           : ${liveQuote?.fiftyTwoWeekLow ?? todayPrice?.fiftyTwoWeekLow ?? "N/A"}
  50-Day Avg            : ${liveQuote?.fiftyDayAverage ?? todayPrice?.fiftyDayAverage ?? "N/A"}
  200-Day Avg           : ${liveQuote?.twoHundredDayAverage ?? todayPrice?.twoHundredDayAverage ?? "N/A"}

◆ FUNDAMENTALS (from DB — last recorded)
  Trailing P/E          : ${todayPrice?.trailingPE ?? "N/A"}
  Forward P/E           : ${todayPrice?.forwardPE ?? "N/A"}
  EPS (TTM)             : ${todayPrice?.epsTrailingTwelveMonths ?? "N/A"}
  EPS (Forward)         : ${todayPrice?.epsForward ?? "N/A"}
  Price-to-Book         : ${todayPrice?.priceToBook ?? "N/A"}
  Market Cap            : ${todayPrice?.marketCap ?? "N/A"}
  Dividend Yield        : ${todayPrice?.dividendYield ?? "N/A"}
  Trailing Annual Div Yield : ${todayPrice?.trailingAnnualDividendYield ?? "N/A"}
  Analyst Rating (avg)  : ${todayPrice?.averageAnalystRating ?? "N/A"}

◆ VOLUME
  Today's Volume        : ${todayPrice?.regularMarketVolume ?? "N/A"}
  3-Month Avg Volume    : ${todayPrice?.averageDailyVolume3Month ?? "N/A"}

◆ DAY-OVER-DAY PRICE CHANGE
  Yesterday Price       : ${yesterdayPrice?.price ?? "N/A"}
  Today Price (DB)      : ${todayPrice?.price ?? "N/A"}

◆ USER'S VAULT HOLDING
  Quantity Held         : ${qty} units
  Avg Buy Price         : ${buyPrice}
  Current Holding Value : ${holdingValue}
  Unrealized P&L        : ${unrealizedPnL} (${pnlPercent})

◆ RECENT NEWS HEADLINES (Yahoo Finance)
${newsHeadlines.length > 0 ? newsHeadlines.join("\n") : "No recent news found. please search news from finance websites for the ticker and analyse the sentiment"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK:
1. Determine the current price movement trend (Uptrend / Downtrend / Sideways) using 52-week range, moving averages, and daily change.
2. Assess the probability of further upward price movement based on fundamentals, valuation, news sentiment, and market conditions.
3. Identify key risks (regulatory, valuation, macro, sector-specific).
4. Consider the previous quarter results context from news and EPS data.
5. Decide whether the user should BUY more, HOLD current position, or SELL, given their existing holding and P&L.
6. Suggest 2-3 related companies in the same sector. Analyze their valuations and market sentiment, and provide a BUY/HOLD/SELL recommendation for each.

YOUR OUTPUT MUST BE VALID JSON EXACTLY MATCHING THIS SCHEMA — no markdown, no explanation outside JSON:
{
  "action": "BUY" | "HOLD" | "SELL",
  "conviction": "High" | "Medium" | "Low",
  "priceMovement": "Uptrend" | "Downtrend" | "Sideways",
  "upwardProbability": "High" | "Medium" | "Low",
  "rationale": "3-4 sentence investment thesis combining fundamentals, price action, and news context",
  "keyRisks": ["Risk 1", "Risk 2", "Risk 3"],
  "newsSentiment": "Bullish" | "Bearish" | "Neutral",
  "newsHighlights": ["key news point 1", "key news point 2"],
  "quarterlyOutlook": "1-2 sentences on next quarter prospects based on EPS trend and news",
  "relatedCompanies": [
    {
      "ticker": "TICKER",
      "companyName": "Name",
      "action": "BUY" | "HOLD" | "SELL",
      "rationale": "1-2 sentence analysis of their valuation and sentiment compared to the main stock"
    }
  ]
}
`;

    // ── 8. Call Gemini ───────────────────────────────────────────────────────
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite", // or gemini-2.0-flash / gemini-1.5-flash
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();

    // Strip markdown code fences if present
    responseText = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    res.status(200).json({
      success: true,
      data: JSON.parse(responseText),
    });
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate response from AI",
      details: error?.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PORTFOLIO-LEVEL ADVISOR
// POST /ai/portfolio-analysis
// ─────────────────────────────────────────────────────────────────────────────
export const getPortfolioAdvisorAnalysis = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ success: false, error: "Gemini API key missing" });
      return;
    }

    const { groupId } = req.body;

    let items;
    if (groupId && groupId !== "__all__") {
      const entries = await PortfolioEntry.find({ portfolioGroup: groupId }).lean();
      const itemIds = entries.map((e: any) => e.portfolioItem);
      items = await PortfolioItem.find({ _id: { $in: itemIds }, user: userId })
        .populate("ticker")
        .lean();
    } else {
      items = await PortfolioItem.find({ user: userId })
        .populate("ticker")
        .lean();
    }

    if (!items || items.length === 0) {
      res
        .status(200)
        .json({ success: false, error: "No holdings found in vault" });
      return;
    }

    // ── 2. Fetch latest daily prices for all tickers ────────────────────────
    const tickerIds = items.map((i: any) => (i.ticker as any)._id);
    const allPrices = await DailyPrice.find({ tickerId: { $in: tickerIds } })
      .sort({ date: -1 })
      .lean();
    const { priceMap } = buildLatestPriceMaps(allPrices as any);

    // Build a map: tickerId → latest DailyPrice doc (for fundamentals)
    const fundamentalMap: Record<string, any> = {};
    for (const p of allPrices as any[]) {
      const tid = p.tickerId.toString();
      if (!fundamentalMap[tid]) fundamentalMap[tid] = p;
    }

    // ── 3. Compute per-holding derived values ───────────────────────────────
    let totalCurrentValue = 0;
    const holdingRows: any[] = [];

    for (const item of items as any[]) {
      const ticker = item.ticker;
      const tid = ticker._id.toString();
      const buyRate = item.exchangeRate || 1;
      const latestPrice = priceMap[tid] ?? item.buyingPrice;
      const fund = fundamentalMap[tid] ?? {};

      const investedINR = investmentINR(
        item.buyingPrice,
        buyRate,
        item.quantity,
      );
      const curINR = currentValueINR(
        latestPrice,
        item.buyingPrice,
        buyRate,
        item.quantity,
      );
      const plINR = curINR - investedINR;
      const plPct = unrealisedPLPercent(item.buyingPrice, latestPrice);

      totalCurrentValue += curINR;

      holdingRows.push({
        ticker: ticker.tickerName,
        name: ticker.name,
        type: ticker.type,
        sector: ticker.sector ?? "N/A",
        market: ticker.market,
        currency: ticker.currency,
        quantity: item.quantity,
        buyPrice: item.buyingPrice,
        currentPrice: latestPrice,
        investedINR,
        currentValueINR: curINR,
        plINR,
        plPct,
        // Fundamentals
        trailingPE: fund.trailingPE ?? null,
        forwardPE: fund.forwardPE ?? null,
        marketCap: fund.marketCap ?? null,
        priceToBook: fund.priceToBook ?? null,
        epsTrailingTwelveMonths: fund.epsTrailingTwelveMonths ?? null,
        dividendYield: fund.dividendYield ?? null,
        fiftyTwoWeekHigh: fund.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: fund.fiftyTwoWeekLow ?? null,
        fiftyDayAverage: fund.fiftyDayAverage ?? null,
        twoHundredDayAverage: fund.twoHundredDayAverage ?? null,
        averageAnalystRating: fund.averageAnalystRating ?? null,
      });
    }

    // ── 4. Attach portfolio weight to each holding ──────────────────────────
    holdingRows.forEach((h) => {
      h.weight =
        totalCurrentValue > 0
          ? ((h.currentValueINR / totalCurrentValue) * 100).toFixed(1) + "%"
          : "0%";
    });

    // ── 5. Fetch recent news for top 3 holdings (by value) ──────────────────
    const top3 = [...holdingRows]
      .sort((a, b) => b.currentValueINR - a.currentValueINR)
      .slice(0, 3);
    const newsMap: Record<string, string[]> = {};
    await Promise.all(
      top3.map(async (h) => {
        try {
          const searchRes = await yahooFinance.search(h.ticker, {
            newsCount: 3,
          });
          newsMap[h.ticker] = (searchRes.news ?? []).map(
            (n: any) => `• ${n.title}`,
          );
        } catch {
          newsMap[h.ticker] = [];
        }
      }),
    );

    // ── 6. Build sector & type summaries for the prompt ─────────────────────
    const sectorMap: Record<string, { value: number; tickers: string[] }> = {};
    const typeMap: Record<string, number> = {};
    holdingRows.forEach((h) => {
      const sec = h.sector;
      if (!sectorMap[sec]) sectorMap[sec] = { value: 0, tickers: [] };
      sectorMap[sec].value += h.currentValueINR;
      sectorMap[sec].tickers.push(h.ticker);
      typeMap[h.type] = (typeMap[h.type] || 0) + h.currentValueINR;
    });

    const totalInvested = holdingRows.reduce((s, h) => s + h.investedINR, 0);
    const totalPL = totalCurrentValue - totalInvested;
    const totalPLPct =
      totalInvested > 0 ? ((totalPL / totalInvested) * 100).toFixed(2) : "0";

    // ── 7. Build the prompt ─────────────────────────────────────────────────
    const holdingsText = holdingRows
      .map(
        (h) => `
  ▸ ${h.ticker} (${h.name}) | ${h.type} | Sector: ${h.sector} | Market: ${h.market}
    Qty: ${h.quantity} @ Avg Buy: ${h.buyPrice} ${h.currency}
    Current Price: ${h.currentPrice} | Value (INR): ₹${h.currentValueINR.toFixed(0)} | Weight: ${h.weight}
    P&L: ₹${h.plINR.toFixed(0)} (${h.plPct.toFixed(1)}%) | 52W High: ${h.fiftyTwoWeekHigh ?? "N/A"} | 52W Low: ${h.fiftyTwoWeekLow ?? "N/A"}
    P/E (Trail): ${h.trailingPE ?? "N/A"} | P/E (Fwd): ${h.forwardPE ?? "N/A"} | P/B: ${h.priceToBook ?? "N/A"}
    Market Cap: ${h.marketCap ?? "N/A"} | Div Yield: ${h.dividendYield ?? "N/A"} | Analyst Rating: ${h.averageAnalystRating ?? "N/A"}
    50DMA: ${h.fiftyDayAverage ?? "N/A"} | 200DMA: ${h.twoHundredDayAverage ?? "N/A"}${newsMap[h.ticker] ? `\n    Recent News:\n    ${newsMap[h.ticker].join("\n    ")}` : ""}`,
      )
      .join("\n");

    const sectorText = Object.entries(sectorMap)
      .map(
        ([sec, d]) =>
          `  ${sec}: ${((d.value / totalCurrentValue) * 100).toFixed(1)}% (${d.tickers.join(", ")})`,
      )
      .join("\n");

    const typeText = Object.entries(typeMap)
      .map(
        ([type, val]) =>
          `  ${type}: ${((val / totalCurrentValue) * 100).toFixed(1)}%`,
      )
      .join("\n");

    const prompt = `
You are a senior financial planner and portfolio advisor with 20+ years of investment experience across equity, mutual funds, and global markets. You apply the principles of Warren Buffett, Peter Lynch, and Ray Dalio — balancing value investing, growth momentum, and risk-adjusted returns.

Analyse the user's COMPLETE INVESTMENT VAULT below and return a comprehensive, structured JSON recommendation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PORTFOLIO SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total Invested (INR) : ₹${totalInvested.toFixed(0)}
  Current Value (INR)  : ₹${totalCurrentValue.toFixed(0)}
  Total P&L            : ₹${totalPL.toFixed(0)} (${totalPLPct}%)
  Number of Holdings   : ${holdingRows.length}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ASSET TYPE ALLOCATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${typeText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTOR ALLOCATION (Stocks only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${sectorText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DETAILED HOLDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${holdingsText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK:
1. Score this portfolio overall (1–10) on diversification, quality of holdings, and valuation.
2. Assess the risk level of the portfolio (Low / Medium / High / Very High).
3. Rate the diversification (Poor / Fair / Good / Excellent).
4. Write a 3-4 sentence overall portfolio strategy recommendation.
5. For EACH holding, decide: BUY more / HOLD / SELL / REDUCE — with a 1-2 sentence conviction rationale. Also suggest an ideal target portfolio weight.
6. Provide sector-level insights — which sectors are overweight/underweight and what to do.
7. List the top 3 key risks facing this portfolio.
8. List the top 3 actionable opportunities the investor should consider.

YOUR OUTPUT MUST BE VALID JSON EXACTLY MATCHING THIS SCHEMA — no markdown, no explanation outside JSON:
{
  "overallStrategy": "string — 3-4 sentence portfolio-level thesis and strategy",
  "portfolioScore": number (1-10),
  "diversificationRating": "Poor" | "Fair" | "Good" | "Excellent",
  "riskLevel": "Low" | "Medium" | "High" | "Very High",
  "topRecommendation": "string — single most important action the investor should take right now",
  "holdings": [
    {
      "ticker": "string",
      "companyName": "string",
      "action": "BUY" | "HOLD" | "SELL" | "REDUCE",
      "conviction": "High" | "Medium" | "Low",
      "rationale": "string — 1-2 sentences",
      "targetWeight": "string — e.g. '8%'"
    }
  ],
  "sectorInsights": [
    {
      "sector": "string",
      "currentWeight": "string — e.g. '35%'",
      "stance": "Overweight" | "Underweight" | "Maintain",
      "insight": "string — 1 sentence"
    }
  ],
  "keyRisks": ["string", "string", "string"],
  "opportunities": ["string", "string", "string"]
}
`;

    // ── 8. Call Gemini ──────────────────────────────────────────────────────
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: { responseMimeType: "application/json" },
    });

    const aiResult = await model.generateContent(prompt);
    let responseText = aiResult.response.text();
    responseText = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // ── 9. Also return the holdings data for the frontend charts ────────────
    const holdingsForFrontend = holdingRows.map((h) => ({
      ticker: h.ticker,
      name: h.name,
      type: h.type,
      sector: h.sector,
      market: h.market,
      currency: h.currency,
      quantity: h.quantity,
      buyPrice: h.buyPrice,
      currentPrice: h.currentPrice,
      investedINR: h.investedINR,
      currentValueINR: h.currentValueINR,
      plINR: h.plINR,
      plPct: h.plPct,
      weight: h.weight,
      fiftyTwoWeekHigh: h.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: h.fiftyTwoWeekLow,
      trailingPE: h.trailingPE,
      forwardPE: h.forwardPE,
      marketCap: h.marketCap,
      priceToBook: h.priceToBook,
      averageAnalystRating: h.averageAnalystRating,
    }));

    res.status(200).json({
      success: true,
      portfolioSummary: {
        totalInvested,
        totalCurrentValue,
        totalPL,
        totalPLPct: parseFloat(totalPLPct),
        holdingCount: holdingRows.length,
      },
      holdings: holdingsForFrontend,
      analysis: JSON.parse(responseText),
    });
  } catch (error: any) {
    console.error("Error in portfolio advisor:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate portfolio analysis",
      details: error?.message,
    });
  }
};
