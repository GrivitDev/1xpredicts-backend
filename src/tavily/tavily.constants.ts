// src/tavily/tavily.constants.ts

export const TAVILY_API_KEY_ENV = 'TAVILY_API_KEY';

export const TAVILY_BASE_OPTIONS = {
  searchDepth: 'basic' as const,
  maxResults: 5,
  topic: 'general' as const,
  includeAnswer: false as const,
  includeRawContent: false as const,
  includeImages: false as const,
  includeImageDescriptions: false as const,
  includeUsage: true as const,
};
