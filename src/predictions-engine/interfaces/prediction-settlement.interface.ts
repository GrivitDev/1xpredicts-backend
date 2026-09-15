import { SettlementStatus } from '../enums/settlement-status.enum';

export interface PredictionSettlement {
  status: SettlementStatus;

  actualOutcome: boolean | null;
  actualValue: unknown | null;
  resultLabel: string | null;

  finalHomeScore: number | null;
  finalAwayScore: number | null;

  halfTimeHomeScore: number | null;
  halfTimeAwayScore: number | null;

  source: string;
  settlementVersion: string;

  settledAt: Date | null;
}
