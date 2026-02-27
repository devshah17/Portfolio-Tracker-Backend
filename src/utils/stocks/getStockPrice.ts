import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Resolve the Yahoo Finance symbol for a given symbol + currency pair.
 * Indian stocks traded in INR get the .NS suffix appended if missing.
 */
const resolveSymbol = (symbol: string, currency: string): string => {
  if (currency === 'INR' && !symbol.endsWith('.NS') && !symbol.includes('.')) {
    return `${symbol}.NS`;
  }
  return symbol;
};

export const getStockPrice = async (
  symbols: { symbol: string; currency: string }[]
): Promise<{ symbol: string; price: any }[] | null> => {
  if (symbols.length === 0) return null;

  // Build resolved symbol list (keeping original symbol for result mapping)
  const resolved = symbols.map((item) => ({
    original: item.symbol,
    yahoo: resolveSymbol(item.symbol, item.currency),
  }));

  // ── Strategy 1: Batch request (single API call for all symbols) ──────────
  try {
    console.log(`[getStockPrice] Batch fetching ${resolved.length} symbols:`, resolved.map((r) => r.yahoo));

    const yahooSymbols = resolved.map((r) => r.yahoo);
    const batchResult = await yahooFinance.quote(yahooSymbols as any);

    // quote() returns an array when passed an array
    const quotesArray: any[] = Array.isArray(batchResult) ? batchResult : [batchResult];

    const results: { symbol: string; price: any }[] = [];

    for (const quoteItem of quotesArray) {
      // Find original symbol by matching yahoo symbol
      const match = resolved.find(
        (r) => r.yahoo === quoteItem.symbol || r.original === quoteItem.symbol
      );
      if (match && quoteItem.regularMarketPrice) {
        results.push({ symbol: match.original, price: quoteItem });
      }
    }

    const failedCount = symbols.length - results.length;
    if (failedCount > 0) {
      const fetchedSymbols = new Set(results.map((r) => r.symbol));
      const failed = symbols.filter((s) => !fetchedSymbols.has(s.symbol)).map((s) => s.symbol);
      console.warn(`[getStockPrice] Batch: no price data for ${failedCount} symbol(s):`, failed);
    }

    if (results.length > 0) {
      console.log(`[getStockPrice] Batch succeeded for ${results.length}/${symbols.length} symbols`);
      return results;
    }

    console.warn('[getStockPrice] Batch returned no results, falling back to sequential fetching');
  } catch (batchError) {
    const msg = batchError instanceof Error ? batchError.message : String(batchError);
    console.warn('[getStockPrice] Batch request failed, falling back to sequential fetching:', msg);
  }

  // ── Strategy 2: Rate-limited sequential fallback (max 3 concurrent) ──────
  console.log('[getStockPrice] Using sequential fallback with rate limiting');

  const CONCURRENCY = 3;
  const DELAY_MS = 500;

  const results: { symbol: string; price: any }[] = [];
  const chunks: (typeof resolved)[] = [];

  for (let i = 0; i < resolved.length; i += CONCURRENCY) {
    chunks.push(resolved.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.allSettled(
      chunk.map(async (item) => {
        try {
          const quote = await yahooFinance.quote(item.yahoo);
          return { symbol: item.original, price: quote };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.warn(`[getStockPrice] Failed to fetch ${item.yahoo}:`, errorMessage);
          return { symbol: item.original, price: null };
        }
      })
    );

    for (const res of chunkResults) {
      const val = res.status === 'fulfilled' ? (res as PromiseFulfilledResult<{ symbol: string; price: any }>).value : null;
      if (val && val.price?.regularMarketPrice) {
        results.push(val);
      }
    }

    // Throttle between chunks
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`[getStockPrice] Sequential fallback: ${results.length}/${symbols.length} symbols fetched`);
  return results.length > 0 ? results : null;
};
