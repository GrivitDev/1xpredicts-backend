/**
 * YouTube Data API v3 response contracts used by the
 * match-highlight collector.
 */

export interface YouTubeThumbnail {
  url: string;
  width: number;
  height: number;
}

export interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];

  nextPageToken?: string;

  pageInfo?: {
    totalResults?: number;
    resultsPerPage?: number;
  };
}

export interface YouTubeSearchItem {
  id?: {
    kind?: string;
    videoId?: string;
  };

  snippet?: YouTubeVideoSnippet;
}

export interface YouTubeVideoSnippet {
  publishedAt?: string;

  channelId?: string;

  title?: string;

  description?: string;

  thumbnails?: {
    default?: YouTubeThumbnail;
    medium?: YouTubeThumbnail;
    high?: YouTubeThumbnail;
    standard?: YouTubeThumbnail;
    maxres?: YouTubeThumbnail;
  };

  channelTitle?: string;

  liveBroadcastContent?: string;
}

export interface YouTubeVideosResponse {
  items?: YouTubeVideoItem[];
}

export interface YouTubeVideoItem {
  id?: string;

  snippet?: YouTubeVideoSnippet;

  contentDetails?: {
    duration?: string;
  };

  status?: {
    uploadStatus?: string;
    privacyStatus?: string;
    embeddable?: boolean;
    license?: string;
  };
}

export interface YouTubeSearchOptions {
  query: string;

  channelId?: string;

  maxResults?: number;

  publishedAfter?: string;

  publishedBefore?: string;
}

export interface YouTubeVideoResult {
  [x: string]: unknown;

  videoId: string;

  channelId?: string;

  channelTitle?: string;

  title: string;

  description?: string;

  publishedAt?: Date;

  thumbnailUrl?: string;

  embeddable: boolean;

  duration?: string;
}

export interface YouTubeHighlightSearchResult {
  video: YouTubeVideoResult;

  score: number;
}
