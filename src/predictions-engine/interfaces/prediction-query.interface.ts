import { PredictionMarket } from '../enums/prediction-market.enum';
import { PredictionStatus } from '../enums/prediction-status.enum';

export interface PredictionQuery {
  eventId?: string;
  competitionId?: string;

  market?: PredictionMarket;
  status?: PredictionStatus;

  from?: Date;
  to?: Date;

  page?: number;
  limit?: number;
}
