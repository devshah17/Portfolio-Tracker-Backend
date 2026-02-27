import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Append .NS suffix for Indian stocks (INR currency) if not already present. */
const resolveSymbol = (symbol: string, currency: string): string => {
  if (currency === "INR" && !symbol.endsWith(".NS") && !symbol.includes(".")) {
    return `${symbol}.NS`;
  }
  return symbol;
};

const DELAY_MS = 600; // ms between each request to avoid Yahoo 429

export const getStockPrice = async (
  symbols: { symbol: string; currency: string }[]
): Promise<{ symbol: string; price: any }[] | null> => {
  if (symbols.length === 0) return null;

  const results: { symbol: string; price: any }[] = [];

  for (let i = 0; i < symbols.length; i++) {
    const item = symbols[i];
    const yahooSymbol = resolveSymbol(item.symbol, item.currency);

    try {
      console.log(`[getStockPrice] Fetching ${yahooSymbol} (${i + 1}/${symbols.length})`);
      const quote = await yahooFinance.quote(yahooSymbol);

      if (quote?.regularMarketPrice) {
        results.push({ symbol: item.symbol, price: quote });
      } else {
        console.warn(`[getStockPrice] No price data for ${yahooSymbol}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[getStockPrice] Failed to fetch ${yahooSymbol}:`, msg);
    }

    // Delay between requests (skip after last symbol)
    if (i < symbols.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`[getStockPrice] Done: ${results.length}/${symbols.length} symbols fetched`);
  return results.length > 0 ? results : null;
};
