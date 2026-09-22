export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  publishedAt: string;
  source: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  impact: "HIGH" | "MEDIUM" | "LOW";
  symbols: string[];
}

export interface SentimentData {
  value: number;
  classification: string;
  timestamp: string;
}
