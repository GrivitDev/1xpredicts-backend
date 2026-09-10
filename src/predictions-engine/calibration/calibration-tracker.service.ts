import { Injectable } from '@nestjs/common';

import { CalibrationService } from './calibration.service';

@Injectable()
export class CalibrationTrackerService {
  constructor(private readonly calibrationService: CalibrationService) {}

  async trackPredictionResult(input: {
    predictionId: string;
    fixtureId: string;
    market: string;
    selection: string;
    probability: number;
    confidence: number;
    actualOutcome: boolean;
  }): Promise<void> {
    await this.calibrationService.recordResult({
      predictionId: input.predictionId,
      fixtureId: input.fixtureId,
      market: input.market,
      selection: input.selection,
      probability: input.probability,
      confidence: input.confidence,
      wasCorrect: input.actualOutcome,
    });
  }

  async applyCalibration(market: string, probability: number): Promise<number> {
    const adjustment = await this.calibrationService.getAdjustment(
      market,
      probability,
    );

    return Math.min(1, Math.max(0, probability + adjustment));
  }
}
