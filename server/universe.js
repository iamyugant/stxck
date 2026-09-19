// Large-cap US universe for the screener (sector labels are GICS-style, static).
export const SCREENER_UNIVERSE = [
  ['AAPL', 'Apple', 'Technology'], ['MSFT', 'Microsoft', 'Technology'], ['NVDA', 'Nvidia', 'Technology'],
  ['AVGO', 'Broadcom', 'Technology'], ['ORCL', 'Oracle', 'Technology'], ['AMD', 'AMD', 'Technology'],
  ['CRM', 'Salesforce', 'Technology'], ['ADBE', 'Adobe', 'Technology'], ['INTC', 'Intel', 'Technology'],
  ['GOOGL', 'Alphabet', 'Communication'], ['META', 'Meta Platforms', 'Communication'], ['NFLX', 'Netflix', 'Communication'],
  ['DIS', 'Disney', 'Communication'], ['AMZN', 'Amazon', 'Consumer Disc.'], ['TSLA', 'Tesla', 'Consumer Disc.'],
  ['HD', 'Home Depot', 'Consumer Disc.'], ['MCD', "McDonald's", 'Consumer Disc.'], ['NKE', 'Nike', 'Consumer Disc.'],
  ['WMT', 'Walmart', 'Consumer Staples'], ['COST', 'Costco', 'Consumer Staples'], ['PG', 'Procter & Gamble', 'Consumer Staples'],
  ['KO', 'Coca-Cola', 'Consumer Staples'], ['JPM', 'JPMorgan Chase', 'Financial'], ['BAC', 'Bank of America', 'Financial'],
  ['V', 'Visa', 'Financial'], ['MA', 'Mastercard', 'Financial'], ['GS', 'Goldman Sachs', 'Financial'],
  ['BRK-B', 'Berkshire Hathaway', 'Financial'], ['LLY', 'Eli Lilly', 'Healthcare'], ['UNH', 'UnitedHealth', 'Healthcare'],
  ['JNJ', 'Johnson & Johnson', 'Healthcare'], ['ABBV', 'AbbVie', 'Healthcare'], ['MRK', 'Merck', 'Healthcare'],
  ['PFE', 'Pfizer', 'Healthcare'], ['XOM', 'Exxon Mobil', 'Energy'], ['CVX', 'Chevron', 'Energy'],
  ['CAT', 'Caterpillar', 'Industrials'], ['GE', 'GE Aerospace', 'Industrials'], ['BA', 'Boeing', 'Industrials'],
  ['NEE', 'NextEra Energy', 'Utilities'], ['PLD', 'Prologis', 'Real Estate'], ['LIN', 'Linde', 'Materials'],
].map(([symbol, name, sector]) => ({ symbol, name, sector }))
