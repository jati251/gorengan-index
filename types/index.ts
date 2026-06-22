export interface RegionalIndex {
  region: string;
  ump: number;
  bakwanPrice: number;
  tahuPrice: number;
  tempePrice: number;
  chiliRatio: number;      
  sizePercentage: number;  
  inflationRate: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'STAGNANT';
  // Additional data from DB
  population?: number;
  gdpPerCapita?: number;
  dominantCommodity?: string;
}

export interface MacroData {
  kursIDR: number;
  isRaining: boolean;
  temperature: number;
  wheatIndex: number;
  palmOilIndex: number;
  btcIdrPrice: number;
  marketSentiment: string;
}

export interface NewsHeadline {
  title: string;
  link: string;
  pubDate: string;
}

export interface DashboardData {
  timestamp: string;
  macro: MacroData;
  newsHeadlines: NewsHeadline[];
  regions: RegionalIndex[];
  volatilityIndex: number;
}
