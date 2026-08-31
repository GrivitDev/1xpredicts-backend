// src/tavily/tavily.interfaces.ts

export interface TavilySearchOptions {
  searchDepth?: 'basic' | 'advanced' | 'fast' | 'ultra-fast';

  topic?: 'general' | 'news' | 'finance';

  maxResults?: number;

  timeRange?: 'day' | 'week' | 'month' | 'year';

  startDate?: string;

  endDate?: string;

  includeDomains?: string[];

  excludeDomains?: string[];

  includeAnswer?: boolean | 'basic' | 'advanced';

  includeRawContent?: false | 'text' | 'markdown';

  includeImages?: boolean;

  includeImageDescriptions?: boolean;
}

export interface TavilySearchSource {
  title: string;

  url: string;

  content?: string;

  score?: number;

  rawContent?: string | null;

  favicon?: string;

  publishedDate?: string;
}

export interface TavilySearchResult {
  query: string;

  answer: string | null;

  results: TavilySearchSource[];

  images: string[];

  responseTime?: number;

  usage?: {
    credits?: number;
  };
}
