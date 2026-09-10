import { Injectable } from '@nestjs/common';

import { ConfidenceCalculator } from '../calculators/confidence.calculator';

import { OddsCalculator } from '../calculators/odds.calculator';

import { PredictionSource } from '../enums/prediction-source.enum';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { PredictionStatus } from '../enums/prediction-status.enum';

import { StatisticalModelOutput } from '../interfaces/statistical-model.interface';

import { PredictionSignal } from '../interfaces/prediction-signal.interface';

@Injectable()
export class StatisticalSignalService {
  constructor(
    private readonly confidenceCalculator: ConfidenceCalculator,

    private readonly oddsCalculator: OddsCalculator,
  ) {}

  build(
    output: StatisticalModelOutput & {
      marketResults: Array<{
        market: string;
        selections: Array<{
          market: string;
          selection: string;
          label: string;
          probability: number;
        }>;
      }>;
    },
  ): PredictionSignal {
    const recommendations = output.marketResults.flatMap((marketResult) =>
      marketResult.selections.map((selection) => {
        const probability = this.toPercentage(selection.probability);

        const confidence = this.confidenceCalculator.calculate({
          probability,

          dataQuality: output.dataQuality,

          sourceAgreement: 100,

          historicalCalibration: 70,

          sampleQuality: output.sampleQuality,
        });

        return {
          market: selection.market as PredictionMarket,

          selection: selection.selection,

          probability,

          confidence,

          odds: this.oddsCalculator.percentageToFairOdds(probability),

          reasonCodes: output.reasonCodes,
        };
      }),
    );

    return {
      source: PredictionSource.STATISTICAL,

      status:
        recommendations.length > 0
          ? PredictionStatus.COMPLETED
          : PredictionStatus.INSUFFICIENT_DATA,

      generatedAt: output.generatedAt,

      modelName: '2xPredict Statistical Model',

      modelVersion: '1.0.0',

      matchProbability: {
        home: this.toPercentage(output.matchProbability.home),

        draw: this.toPercentage(output.matchProbability.draw),

        away: this.toPercentage(output.matchProbability.away),
      },

      recommendations,

      dataQuality: output.dataQuality,
    };
  }

  private toPercentage(probability: number): number {
    if (!Number.isFinite(probability)) {
      return 0;
    }

    return Number(
      Math.max(
        0,
        Math.min(100, probability <= 1 ? probability * 100 : probability),
      ).toFixed(2),
    );
  }
}
