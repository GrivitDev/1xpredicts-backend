export enum YoutubeHighlightStatus {
  PENDING = 'PENDING',
  SEARCHING = 'SEARCHING',
  FOUND = 'FOUND',
  NOT_FOUND = 'NOT_FOUND',
  RETRY = 'RETRY',
  SKIPPED = 'SKIPPED',
}

export interface YoutubeHighlight {
  fixtureId: string;

  competitionId?: string;

  homeTeam: string;
  awayTeam: string;

  status: YoutubeHighlightStatus;

  retryCount: number;

  searchedAt?: Date;

  nextRetryAt?: Date;

  videoId?: string;
  videoUrl?: string;

  title?: string;

  channelId?: string;
  channelTitle?: string;

  publishedAt?: Date;
  thumbnailUrl?: string;

  error?: string;
}
