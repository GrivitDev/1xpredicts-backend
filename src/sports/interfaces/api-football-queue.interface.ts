export enum ApiFootballQueueJobType {
  FIXTURES = 'FIXTURES',
  STANDINGS = 'STANDINGS',
  TEAM_STATISTICS = 'TEAM_STATISTICS',
  INJURIES = 'INJURIES',
  PREDICTION = 'PREDICTION',
}

export enum ApiFootballQueueStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export interface ApiFootballQueueJob {
  competitionId: string;

  apiFootballLeagueId?: number;
  season?: number;
  apiFootballTeamId?: number;
  apiFootballFixtureId?: number;

  type: ApiFootballQueueJobType;

  priority: number;

  status: ApiFootballQueueStatus;

  attempts: number;
  maxAttempts: number;

  scheduledFor: Date;

  startedAt?: Date;
  nextAttemptAt?: Date;
  completedAt?: Date;
  processedAt?: Date;

  error?: string;
}
