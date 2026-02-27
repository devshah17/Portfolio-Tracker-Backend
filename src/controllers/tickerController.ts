import { Request, Response } from "express";
import {
  createTicker,
  deleteTicker,
  getAllTickers,
  getTickerById,
  updateTicker,
} from "../services/tickerServices";
import { getStockPrice } from "../utils/stocks/getStockPrice";

const getAllMutualFundsNAV = async () => {
  try {
    const response = await fetch('https://api.mfapi.in/mf/latest', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text.substring(0, 200));
      throw new Error('API returned non-JSON response');
    }
    
    const data = await response.json();
    
    if (data.length > 0) {
      const mfMap = new Map();
    
      data.forEach((mf: any) => {
        mfMap.set(mf.schemeCode, mf);
        if (mf.isinGrowth) {
          mfMap.set(mf.isinGrowth, mf);
        }
        if (mf.isinDivReinvestment) {
          mfMap.set(mf.isinDivReinvestment, mf);
        }
      });
      
      return mfMap;
    } else {
      throw new Error('Failed to fetch mutual funds data');
    }
  } catch (error) {
    console.error('Error fetching all mutual funds NAV:', error);
    throw error;
  }
};

export const createTickerController = async (req: Request, res: Response) => {
  try {
    const { name, tickerName, type, currency, market } = req.body;
    const { message, data } = await createTicker({
      name,
      tickerName,
      type,
      currency,
      market,
    });

    if (message !== "Ticker created successfully") {
      return res.status(400).json({ message });
    }

    return res.status(201).json({ message, data });
  } catch (error: any) {
    console.log("Error creating ticker:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getAllTickersController = async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const { message, data } = await getAllTickers();
    
    let filteredData = data || [];
    
    // Filter by type if specified
    if (type) {
      filteredData = (data || []).filter((ticker: any) => ticker.type === type);
    }
    
    // If no type filter or type includes Stock, fetch stock prices
    if (!type || type === "Stock") {
      const stocks = filteredData.filter((ticker: any) => ticker.type === "Stock");
      
      if (stocks.length > 0) {
        try {
          const stockSymbols = stocks.map((stock: any) => ({
            symbol: stock.tickerName,
            currency: stock.currency
          }));
          console.log("Fetching stock prices for symbols:", stockSymbols);
          const stockPrices = await getStockPrice(stockSymbols);
          console.log("Stock prices response:", stockPrices);
          
          if (stockPrices && stockPrices.length > 0) {
            const stocksWithPrices = filteredData.map((ticker: any) => {
              const tickerObj = ticker.toObject ? ticker.toObject() : ticker;
              
              if (ticker.type === "Stock") {
                const stockData = stockPrices.find((s: any) => s.symbol === ticker.tickerName);
                if(ticker.tickerName === "ATGL") {

                  console.log(`Matching stock data for ${ticker.tickerName}:`, stockData);
                }
                if (stockData && stockData.price && stockData.price.regularMarketPrice) {
                  return {
                    ...tickerObj,
                    price: stockData.price.regularMarketPrice,
                    currency: stockData.price.currency || ticker.currency,
                    priceDate: new Date(stockData.price.regularMarketTime || Date.now()),
                    source: "Yahoo Finance"
                  };
                } else {
                  console.log(`No price data found for ${ticker.tickerName}`);
                  return {
                    ...tickerObj,
                    price: null,
                    source: "Yahoo Finance",
                    error: "No price data available"
                  };
                }
              }
              
              return tickerObj;
            });
            
            filteredData = stocksWithPrices;
          } else {
            console.log("No successful stock price data received");
            // Add error info to stocks that couldn't be fetched
            filteredData = filteredData.map((ticker: any) => {
              const tickerObj = ticker.toObject ? ticker.toObject() : ticker;
              if (ticker.type === "Stock") {
                return {
                  ...tickerObj,
                  price: null,
                  source: "Yahoo Finance",
                  error: "Failed to fetch price data"
                };
              }
              return tickerObj;
            });
          }
        } catch (error) {
          console.error('Error fetching stock prices:', error);
        }
      }
    }
    
    // If no type filter or type includes MF, fetch mutual fund NAV data
    if (!type || type === "MF") {
      const mutualFunds = filteredData.filter((ticker: any) => ticker.type === "MF");
      
      if (mutualFunds.length > 0) {
        try {
          const mfMap = await getAllMutualFundsNAV();
          
          const mutualFundsWithNAV = filteredData.map((ticker: any) => {
            const tickerObj = ticker.toObject ? ticker.toObject() : ticker;
            
            if (ticker.type === "MF") {
              // Try to match by tickerName (schemeCode) first
              let mfData = mfMap.get(ticker.tickerName);
              
              // If not found by tickerName, try other fields
              if (!mfData) {
                // Try to find by matching scheme name parts
                for (const [key, value] of mfMap.entries()) {
                  if (typeof value === 'object' && value !== null) {
                    const mf = value as any;
                    if (mf.schemeName.toLowerCase().includes(ticker.name.toLowerCase()) ||
                        mf.schemeName.toLowerCase().includes(ticker.tickerName.toLowerCase())) {
                      mfData = mf;
                      break;
                    }
                  }
                }
              }
              
              if (mfData) {
                console.log(`Found NAV for ${ticker.name}: ${mfData.nav}`);
                return {
                  ...tickerObj,
                  price: parseFloat(mfData.nav),
                  currency: ticker.currency,
                  priceDate: new Date(mfData.date),
                  source: "MF API",
                  schemeName: mfData.schemeName,
                  navDate: mfData.date,
                  schemeCode: mfData.schemeCode,
                  fundHouse: mfData.fundHouse,
                  schemeCategory: mfData.schemeCategory
                };
              } else {
                console.log(`No NAV data found for ${ticker.name} (${ticker.tickerName})`);
                return {
                  ...tickerObj,
                  price: null,
                  source: "MF API",
                  error: "No matching NAV data found"
                };
              }
            }
            
            return tickerObj;
          });
          
          filteredData = mutualFundsWithNAV;
        } catch (error) {
          console.error('Error fetching mutual funds NAV:', error);
          // Return the filtered data without NAV if API fails
          const mfWithError = filteredData.map((ticker: any) => {
            const tickerObj = ticker.toObject ? ticker.toObject() : ticker;
            if (ticker.type === "MF") {
              return {
                ...tickerObj,
                price: null,
                source: "MF API",
                error: "NAV fetch failed"
              };
            }
            return tickerObj;
          });
          filteredData = mfWithError;
        }
      }
    }
    
    return res.status(200).json({ message, data: filteredData });
  } catch (error: any) {
    console.log("Error fetching tickers:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getTickerByIdController = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { message, data } = await getTickerById(id);

    if (message === "Invalid ticker ID") {
      return res.status(400).json({ message });
    }

    if (message === "Ticker not found") {
      return res.status(404).json({ message });
    }

    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.log("Error fetching ticker:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateTickerController = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { message, data } = await updateTicker(id, req.body);

    if (message === "Invalid ticker ID") {
      return res.status(400).json({ message });
    }

    if (message === "Ticker not found") {
      return res.status(404).json({ message });
    }

    if (message !== "Ticker updated successfully") {
      return res.status(400).json({ message });
    }

    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.log("Error updating ticker:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const deleteTickerController = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { message } = await deleteTicker(id);

    if (message === "Invalid ticker ID") {
      return res.status(400).json({ message });
    }

    if (message === "Ticker not found") {
      return res.status(404).json({ message });
    }

    if (message !== "Ticker deleted successfully") {
      return res.status(400).json({ message });
    }

    return res.status(200).json({ message });
  } catch (error: any) {
    console.log("Error deleting ticker:", error);
    return res.status(500).json({ message: error.message });
  }
};

// Common function to fetch all prices for stocks and mutual funds
export const getAllPrices = async () => {
  try {
    // Get all tickers from database
    const { message, data: tickers } = await getAllTickers();
    
    if (!tickers || tickers.length === 0) {
      console.log("No tickers found in database");
      return [];
    }

    // Separate stocks and mutual funds
    const stocks = tickers.filter(ticker => ticker.type === "Stock");
    const mutualFunds = tickers.filter(ticker => ticker.type === "MF");

    const allPrices: any[] = [];

    // Fetch stock prices from Yahoo Finance
    if (stocks.length > 0) {
      const stockSymbols = stocks.map(stock => stock.tickerName);
      const stockPrices = await getStockPrice(stockSymbols);
      
      if (stockPrices) {
        stockPrices.forEach((stockData: any) => {
          const ticker = stocks.find(s => s.tickerName === stockData.symbol);
          if (ticker && stockData.price && stockData.price.regularMarketPrice) {
            allPrices.push({
              tickerId: ticker._id,
              tickerName: ticker.tickerName,
              name: ticker.name,
              type: "Stock",
              price: stockData.price.regularMarketPrice,
              currency: stockData.price.currency || ticker.currency,
              market: ticker.market,
              date: new Date(stockData.price.regularMarketTime || Date.now()),
              source: "Yahoo Finance"
            });
          }
        });
      }
    }

    // Fetch mutual fund NAV from MF API
    if (mutualFunds.length > 0) {
      const mfMap = await getAllMutualFundsNAV();
      
      mutualFunds.forEach(mf => {
        // Try to find by schemeCode first, then by name
        let mfData = mfMap.get(mf.tickerName);
        if (!mfData) {
          // Search through all values in the map to find by schemeName
          for (const [key, value] of mfMap.entries()) {
            if (value && typeof value === 'object' && value.schemeName === mf.name) {
              mfData = value;
              break;
            }
          }
        }
        
        if (mfData) {
          allPrices.push({
            tickerId: mf._id,
            tickerName: mf.tickerName,
            name: mf.name,
            type: "MF",
            price: parseFloat(mfData.nav),
            currency: mf.currency,
            market: mf.market,
            date: new Date(mfData.date),
            source: "MF API"
          });
        }
      });
    }

    console.log("Combined prices for all tickers:", allPrices);
    return allPrices;

  } catch (error) {
    console.error("Error fetching all prices:", error);
    return [];
  }
};

// Controller function to get all prices via API
export const getAllPricesController = async (req: Request, res: Response) => {
  try {
    const allPrices = await getAllPrices();
    return res.status(200).json({ 
      message: "All prices fetched successfully", 
      data: allPrices,
      count: allPrices.length 
    });
  } catch (error: any) {
    console.error("Error in getAllPricesController:", error);
    return res.status(500).json({ message: error.message });
  }
};

