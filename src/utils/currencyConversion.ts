export const getExchangeRate = async (from: string, to: string): Promise<number> => {
  try {
    // Using a free exchange rate API
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.rates[to] || 1;
  } catch (error) {
    console.error(`Error fetching exchange rate from ${from} to ${to}:`, error);
    
    // Fallback to common rates if API fails
    const fallbackRates: { [key: string]: number } = {
      'USD-INR': 83.5,
      'EUR-INR': 90.2,
      'GBP-INR': 105.8,
      'INR-USD': 0.012,
      'INR-EUR': 0.011,
      'INR-GBP': 0.0095
    };
    
    return fallbackRates[`${from}-${to}`] || 1;
  }
};

export const convertCurrency = async (
  amount: number, 
  from: string, 
  to: string
): Promise<{ amount: number; rate: number; fromCurrency: string; toCurrency: string }> => {
  if (from === to) {
    return {
      amount,
      rate: 1,
      fromCurrency: from,
      toCurrency: to
    };
  }
  
  const rate = await getExchangeRate(from, to);
  const convertedAmount = amount * rate;
  
  return {
    amount: convertedAmount,
    rate,
    fromCurrency: from,
    toCurrency: to
  };
};
