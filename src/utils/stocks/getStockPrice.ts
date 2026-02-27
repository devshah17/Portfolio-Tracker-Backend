import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export const getStockPrice = async (symbols: { symbol: string; currency: string }[]): Promise<{ symbol: string, price: any }[] | null> => {
  try {
    const quotes = await Promise.allSettled(
      symbols.map(async (item) => {
        try {
          let symbol = item.symbol;
          const targetCurrency = item.currency;
          
          // For Indian stocks, add .NS suffix if not present and currency is INR
          if (targetCurrency === 'INR' && !symbol.endsWith('.NS') && !symbol.includes('.')) {
            symbol = `${symbol}.NS`;
          }
          
          // Add currency parameter for Yahoo Finance
          const quote = await yahooFinance.quote(symbol, {
            fields: ['regularMarketPrice', 'currency', 'regularMarketTime', 'marketState']
          });
          
          return { symbol: item.symbol, price: quote, status: 'fulfilled' };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`Failed to fetch data for ${item.symbol}:`, errorMessage);
          return { symbol: item.symbol, price: null, status: 'rejected', error: errorMessage };
        }
      })
    );

    // Filter out failed requests and return only successful ones
    const successfulQuotes = quotes
      .filter((result: any) => result.status === 'fulfilled' && result.value.price && result.value.price.regularMarketPrice)
      .map((result: any) => result.value);

    const failedQuotes = quotes.filter((result: any) => result.status === 'rejected' || !result.value.price || !result.value.price.regularMarketPrice);
    
    if (failedQuotes.length > 0) {
      console.warn(`Failed to fetch prices for ${failedQuotes.length} symbols:`, failedQuotes.map((f: any) => f.symbol));
    }

    return successfulQuotes.length > 0 ? successfulQuotes : null;
  } catch (error) {
    console.error(`Error fetching stock prices:`, error);
    return null;
  }
};
