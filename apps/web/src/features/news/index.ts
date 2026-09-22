// Components
export { NewsFeed } from "./components/NewsFeed";
export { SentimentGauge } from "./components/SentimentGauge";
export { NewsFeedSkeleton, SentimentSkeleton } from "./components/NewsSkeletons";

// API Hooks
export { useNewsQuery } from "./api/useNewsQuery";
export { useSentimentQuery } from "./api/useSentimentQuery";

// Types
export type { NewsArticle, SentimentData } from "./types";
