import { CompetitionPriority } from '../../sports/enums/competition-priority.enum';
import { PredictionQueueStatus } from '../enums/prediction-queue-status.enum';

export interface PredictionQueueItem {
  eventId: string;

  competitionId: string;

  season: number;

  fixtureDate: Date;

  homeTeamId: string;

  awayTeamId: string;

  priority: CompetitionPriority;

  priorityWeight: number;

  status: PredictionQueueStatus;

  attempts: number;

  availableAt: Date;

  startedAt?: Date;

  completedAt?: Date;

  failedAt?: Date;

  error?: string;
}
