import { PredictionQueueStatus } from '../enums/prediction-queue-status.enum';

export interface PredictionQueuePayload {
  eventId: string;
  competitionId: string;
  season: number;
  fixtureDate: Date;

  homeTeamId: string;
  awayTeamId: string;

  priority: string;
  priorityWeight: number;

  status: PredictionQueueStatus;

  attempts: number;
  maxAttempts: number;

  availableAt: Date;
  lockedUntil: Date | null;

  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;

  lastAttemptAt: Date | null;

  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}
