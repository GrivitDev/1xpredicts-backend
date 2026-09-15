import { SettlementStatus } from '../enums/settlement-status.enum';

export interface SettlementResult {
  eventId: string;
  status: SettlementStatus;

  totalPredictions: number;
  settledPredictions: number;

  wonPredictions: number;
  lostPredictions: number;
  voidPredictions: number;

  finalHomeScore: number;
  finalAwayScore: number;

  halfTimeHomeScore: number | null;
  halfTimeAwayScore: number | null;

  settledAt: Date;
  source: string;
  settlementVersion: string;
}
