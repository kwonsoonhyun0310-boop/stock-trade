export interface AssetSeed {
  symbol: string;
  name: string;
  category: string;
}

export const BLUE_CHIP_UNIVERSE: AssetSeed[] = [
  { symbol: "MSFT", name: "Microsoft", category: "Platform" },
  { symbol: "AAPL", name: "Apple", category: "Consumer Tech" },
  { symbol: "NVDA", name: "NVIDIA", category: "Semiconductors" },
  { symbol: "AMZN", name: "Amazon", category: "Cloud / Retail" },
  { symbol: "GOOGL", name: "Alphabet", category: "Internet Platform" },
  { symbol: "META", name: "Meta Platforms", category: "Digital Advertising" },
  { symbol: "BRK-B", name: "Berkshire Hathaway", category: "Conglomerate" },
  { symbol: "JPM", name: "JPMorgan Chase", category: "Banking" },
  { symbol: "LLY", name: "Eli Lilly", category: "Pharma" },
  { symbol: "AVGO", name: "Broadcom", category: "Semiconductors" },
  { symbol: "V", name: "Visa", category: "Payments" },
  { symbol: "MA", name: "Mastercard", category: "Payments" },
  { symbol: "COST", name: "Costco", category: "Consumer Defensive" },
  { symbol: "XOM", name: "Exxon Mobil", category: "Energy" },
  { symbol: "PG", name: "Procter & Gamble", category: "Consumer Defensive" },
  { symbol: "JNJ", name: "Johnson & Johnson", category: "Healthcare" },
  { symbol: "HD", name: "Home Depot", category: "Retail" },
  { symbol: "KO", name: "Coca-Cola", category: "Consumer Defensive" }
];

export const TRENDING_THEME_UNIVERSE: AssetSeed[] = [
  { symbol: "SMH", name: "VanEck Semiconductor ETF", category: "AI Semiconductors" },
  { symbol: "SOXX", name: "iShares Semiconductor ETF", category: "AI Semiconductors" },
  { symbol: "BOTZ", name: "Global X Robotics & AI ETF", category: "Robotics / AI" },
  { symbol: "CIBR", name: "First Trust Cybersecurity ETF", category: "Cybersecurity" },
  { symbol: "IGV", name: "iShares Expanded Tech-Software ETF", category: "Cloud Software" },
  { symbol: "ITA", name: "iShares US Aerospace & Defense ETF", category: "Defense" },
  { symbol: "PAVE", name: "Global X US Infrastructure ETF", category: "Infrastructure" },
  { symbol: "URA", name: "Global X Uranium ETF", category: "Nuclear" },
  { symbol: "AIQ", name: "Global X Artificial Intelligence ETF", category: "AI Applications" },
  { symbol: "FINX", name: "Global X FinTech ETF", category: "Fintech" },
  { symbol: "ICLN", name: "iShares Global Clean Energy ETF", category: "Clean Energy" },
  { symbol: "XBI", name: "SPDR S&P Biotech ETF", category: "Biotech" },
  { symbol: "HACK", name: "ETFMG Prime Cyber Security ETF", category: "Cybersecurity" },
  { symbol: "XLI", name: "Industrial Select Sector SPDR", category: "Industrials" }
];

export const SECTOR_UNIVERSE: AssetSeed[] = [
  { symbol: "XLK", name: "Technology Select Sector SPDR", category: "Technology" },
  { symbol: "XLC", name: "Communication Services Select Sector SPDR", category: "Communication Services" },
  { symbol: "XLY", name: "Consumer Discretionary Select Sector SPDR", category: "Consumer Discretionary" },
  { symbol: "XLP", name: "Consumer Staples Select Sector SPDR", category: "Consumer Staples" },
  { symbol: "XLE", name: "Energy Select Sector SPDR", category: "Energy" },
  { symbol: "XLF", name: "Financial Select Sector SPDR", category: "Financials" },
  { symbol: "XLV", name: "Health Care Select Sector SPDR", category: "Healthcare" },
  { symbol: "XLI", name: "Industrial Select Sector SPDR", category: "Industrials" },
  { symbol: "XLB", name: "Materials Select Sector SPDR", category: "Materials" },
  { symbol: "XLRE", name: "Real Estate Select Sector SPDR", category: "Real Estate" },
  { symbol: "XLU", name: "Utilities Select Sector SPDR", category: "Utilities" }
];
