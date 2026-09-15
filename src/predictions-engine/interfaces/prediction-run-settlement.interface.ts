import { SettlementStatus } from '../enums/settlement-status.enum';

export interface PredictionRunSettlement {
  status: SettlementStatus;

  total: number;
  settled: number;
  won: number;
  lost: number;
  void: number;

  settledAt: Date | null;

  source: string;
  settlementVersion: string;
}
