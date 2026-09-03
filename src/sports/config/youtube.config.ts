/**
 * YouTube Data API configuration used by the sports highlight collector.
 *
 * The API key is read at runtime by YoutubeService.
 * These values control only the highlight-search queue behavior.
 */

export const YOUTUBE_CONFIG = {
  apiBaseUrl: 'https://www.googleapis.com/youtube/v3',

  /**
   * Search only for video results.
   */
  searchType: 'video',

  /**
   * We only search for highlights after a match has finished.
   */
  defaultSearchWindowMinutes: 20,

  /**
   * Number of times a highlight may be retried when
   * an official highlight has not yet been published.
   */
  maxRetryCount: 3,

  /**
   * Minimum delay between retries for the same fixture.
   */
  retryDelayMinutes: 20,

  /**
   * Only store videos that can be embedded.
   */
  requireEmbeddable: true,
} as const;
