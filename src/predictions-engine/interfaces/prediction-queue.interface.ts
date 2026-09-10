import { PredictionQueueStatus } from '../enums/prediction-queue-status.enum';

export interface PredictionQueueItem {
  fixtureId: number;

  competitionId: string;

  leagueId: number;

  season: number;

  kickoff: Date;

  homeTeamName: string;

  awayTeamName: string;

  status: PredictionQueueStatus;

  priority: number;

  attempts: number;

  maxAttempts: number;

  lockedUntil?: Date;

  startedAt?: Date;

  completedAt?: Date;
}
