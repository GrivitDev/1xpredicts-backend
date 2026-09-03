import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { AiPredictionMatchInput } from './ai-prediction.interfaces';

@Injectable()
export class AiPredictionDataService {
  private readonly logger = new Logger(AiPredictionDataService.name);

  // ==========================================================
  // BUILD MATCH INPUT
  //
  // Temporarily disabled.
  //
  // The old implementation depended on the deleted
  // FootballDataService and its legacy Match model.
  //
  // The AI prediction data pipeline will be rebuilt later
  // directly on top of the new SportsDataReadService.
  // ==========================================================

  buildMatchInput(matchId: string): Promise<AiPredictionMatchInput> {
    if (!matchId?.trim()) {
      throw new BadRequestException('matchId is required');
    }

    this.logger.warn(
      `AI prediction data generation is temporarily disabled for match ${matchId}.`,
    );

    throw new ServiceUnavailableException(
      'AI prediction data is temporarily unavailable while the prediction data pipeline is being rebuilt.',
    );
  }
}
