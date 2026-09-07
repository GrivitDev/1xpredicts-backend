export enum ApiFootballQueueJobType {
  FIXTURES = 'FIXTURES',

  STANDINGS = 'STANDINGS',
}

export enum ApiFootballQueueStatus {
  PENDING = 'PENDING',

  PROCESSING = 'PROCESSING',

  COMPLETED = 'COMPLETED',

  FAILED = 'FAILED',
}

export interface ApiFootballQueueJob {
  /**
   * Internal competition identifier.
   */
  competitionId: string;

  /**
   * Provider league identifier discovered by
   * the competition discovery process.
   */
  apiFootballLeagueId: number;

  /**
   * Provider season year.
   */
  season: number;

  /**
   * Calendar day this collection job belongs to.
   *
   * This prevents one day's queue from interfering
   * with another day's queue.
   */
  collectionDate: string;

  type: ApiFootballQueueJobType;

  priority: number;

  status: ApiFootballQueueStatus;

  /**
   * Number of attempts already consumed.
   */
  attempts: number;

  /**
   * Maximum total attempts, including the first attempt.
   */
  maxAttempts: number;

  scheduledFor: Date;

  startedAt?: Date;

  nextAttemptAt?: Date;

  completedAt?: Date;

  processedAt?: Date;

  error?: string;
}
