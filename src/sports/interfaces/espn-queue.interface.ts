export enum EspnQueueJobType {
  LEAGUE_REFRESH = 'LEAGUE_REFRESH',
  UPCOMING_MATCH = 'UPCOMING_MATCH',
  FINISHED_MATCH = 'FINISHED_MATCH',
}

export enum EspnQueueStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface EspnQueueJob {
  jobKey: string;

  type: EspnQueueJobType;

  /**
   * ESPN league slug.
   */
  leagueId: string;

  /**
   * ESPN season year.
   */
  season?: number;

  /**
   * ESPN event ID.
   *
   * Required for UPCOMING_MATCH and FINISHED_MATCH.
   */
  eventId?: string;

  /**
   * ESPN competition ID.
   *
   * Required when the event contains a competition.
   */
  competitionId?: string;

  /**
   * Queue priority.
   *
   * 1 = ELITE
   * 2 = HIGH
   * 3 = REGIONAL
   * 4 = SELECTIVE
   */
  priority: number;

  status: EspnQueueStatus;

  attempts: number;

  maxAttempts: number;

  scheduledFor: Date;

  nextAttemptAt?: Date;

  startedAt?: Date;

  completedAt?: Date;

  failedAt?: Date;

  lastError?: string;
}
