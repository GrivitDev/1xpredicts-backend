// src/predictions-engine/engines/probability/markets/result.market-engine.ts

import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';

import { MarketModel } from '../../interfaces/market-model.interface';

import { MarketModelInput } from '../../interfaces/market-model-input.interface';

import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';

import { RawGoalModelUtil } from './raw-goal-model.util';

@Injectable()
export class ResultMarketEngine implements MarketModel {
  supports(market: PredictionMarket): boolean {
    return market === PredictionMarket.MATCH_RESULT;
  }

  calculate(input: MarketModelInput): ProbabilityModelResult {
    const goalModel = RawGoalModelUtil.calculate(input.features);

    const goalProbabilities = this.normalizeResultProbabilities({
      home: goalModel.homeWin,
      draw: goalModel.draw,
      away: goalModel.awayWin,
    });

    const comparisonProbabilities = this.calculateComparisonDistribution(input);

    const probabilities = this.reconcileResultDistribution(
      goalProbabilities,
      comparisonProbabilities,
      input,
    );

    const probability = this.getResultProbability(
      input.selection,
      probabilities,
    );

    const sampleSize = Math.max(input.features.overallSampleSize ?? 0, 0);

    const dataQuality = this.clamp(
      input.features.overallDataQuality ?? 0,
      0,
      100,
    );

    const comparisonConfidence = this.clamp(
      input.features.comparison?.confidence ?? 0,
      0,
      1,
    );

    const directionalDifference = this.clamp(
      input.features.comparison?.directionalDifference ?? 0,
      -1,
      1,
    );

    const modelReliability = this.calculateReliability(sampleSize, dataQuality);

    return {
      market: PredictionMarket.MATCH_RESULT,

      selection: input.selection,

      probability,

      supportingProbability: probability,

      sampleSize,

      dataQuality,

      modelReliability,

      modelName: 'raw-result-model',

      modelVersion: 'raw-result-v5',

      modelOutputs: {
        homeWin: probabilities.home,

        draw: probabilities.draw,

        awayWin: probabilities.away,
      },

      modelSignals: {
        homeWin: probabilities.home,

        draw: probabilities.draw,

        awayWin: probabilities.away,

        goalModelHomeWin: goalProbabilities.home,

        goalModelDraw: goalProbabilities.draw,

        goalModelAwayWin: goalProbabilities.away,

        comparisonHomeWin: comparisonProbabilities.home,

        comparisonDraw: comparisonProbabilities.draw,

        comparisonAwayWin: comparisonProbabilities.away,

        directionalDifference,

        comparisonConfidence,

        drawEvidence: this.calculateDrawEvidence(input).value,

        goalProductionDifference: this.clamp(
          input.features.comparison?.goalProduction?.difference ?? 0,
          -1,
          1,
        ),

        goalPreventionDifference: this.clamp(
          input.features.comparison?.goalPrevention?.difference ?? 0,
          -1,
          1,
        ),
      },
    };
  }

  private calculateComparisonDistribution(input: MarketModelInput): {
    home: number;
    draw: number;
    away: number;
  } {
    const comparison = input.features.comparison;

    if (!comparison) {
      return {
        home: 1 / 3,
        draw: 1 / 3,
        away: 1 / 3,
      };
    }

    const directionalDifference = this.clamp(
      comparison.directionalDifference ?? 0,
      -1,
      1,
    );

    const comparisonConfidence = this.clamp(comparison.confidence ?? 0, 0, 1);

    /*
     * Direction controls HOME vs AWAY.
     *
     * Draw is independent and must come from actual draw evidence.
     * Similar team strength is not itself treated as proof of a draw.
     */
    const drawEvidence = this.calculateDrawEvidence(input);

    const directionalStrength = Math.abs(directionalDifference);

    const directionalSignal = this.clamp(
      directionalStrength * comparisonConfidence,
      0,
      1,
    );

    /*
     * Draw share is bounded so the comparison model can express
     * real draw evidence without allowing it to dominate the
     * distribution merely because the teams are close.
     */
    const drawWeight = drawEvidence.available
      ? this.clamp(
          drawEvidence.value * (0.35 + comparisonConfidence * 0.25),
          0,
          0.45,
        )
      : 0.25;

    const nonDrawWeight = 1 - drawWeight;

    const homeSignal = this.clamp(0.5 + directionalDifference * 0.5, 0, 1);

    /*
     * When directional evidence is weak, HOME/AWAY remain close.
     * They are not allowed to collapse simply because comparison
     * confidence exists.
     */
    const directionalFactor = 0.5 + directionalSignal * 0.5;

    const homeShare = 0.5 + (homeSignal - 0.5) * directionalFactor;

    const awayShare = 1 - homeShare;

    const home = homeShare * nonDrawWeight;

    const away = awayShare * nonDrawWeight;

    const draw = drawWeight;

    return this.normalizeResultProbabilities({
      home,
      draw,
      away,
    });
  }

  private calculateDrawEvidence(input: MarketModelInput): {
    value: number;
    available: boolean;
  } {
    const features = input.features;

    const drawRates: number[] = [];

    /*
     * Overall team draw rates.
     */
    this.pushRate(drawRates, features.home, ['drawRate']);

    this.pushRate(drawRates, features.away, ['drawRate']);

    /*
     * Recent draw evidence.
     */
    this.pushRate(drawRates, features.home?.recent, ['drawRate']);

    this.pushRate(drawRates, features.away?.recent, ['drawRate']);

    /*
     * Venue-specific draw evidence.
     */
    this.pushRate(drawRates, features.home?.venue, ['drawRate']);

    this.pushRate(drawRates, features.away?.venue, ['drawRate']);

    /*
     * H2H draw evidence is supplementary.
     */
    this.pushRate(drawRates, features.h2h, ['drawRate']);

    if (!drawRates.length) {
      return {
        value: 0.5,
        available: false,
      };
    }

    const average =
      drawRates.reduce((sum, value) => sum + value, 0) / drawRates.length;

    return {
      value: this.clamp(average, 0, 1),
      available: true,
    };
  }

  private reconcileResultDistribution(
    goalModel: {
      home: number;
      draw: number;
      away: number;
    },
    comparisonModel: {
      home: number;
      draw: number;
      away: number;
    },
    input: MarketModelInput,
  ): {
    home: number;
    draw: number;
    away: number;
  } {
    const comparisonConfidence = this.clamp(
      input.features.comparison?.confidence ?? 0,
      0,
      1,
    );

    const dataQuality = this.clamp(
      (input.features.overallDataQuality ?? 0) / 100,
      0,
      1,
    );

    /*
     * The comparison layer is allowed to challenge the goal
     * matrix more strongly when the comparison data is genuinely
     * complete and reliable.
     */
    const evidenceWeight =
      this.clamp(comparisonConfidence * 0.65 + dataQuality * 0.35, 0, 1) * 0.4;

    const home =
      goalModel.home * (1 - evidenceWeight) +
      comparisonModel.home * evidenceWeight;

    const draw =
      goalModel.draw * (1 - evidenceWeight) +
      comparisonModel.draw * evidenceWeight;

    const away =
      goalModel.away * (1 - evidenceWeight) +
      comparisonModel.away * evidenceWeight;

    return this.normalizeResultProbabilities({
      home,
      draw,
      away,
    });
  }

  private getResultProbability(
    selection: string,
    probabilities: {
      home: number;
      draw: number;
      away: number;
    },
  ): number {
    switch (selection.trim().toUpperCase()) {
      case 'HOME':
      case '1':
      case 'HOME_WIN':
        return probabilities.home;

      case 'DRAW':
      case 'X':
        return probabilities.draw;

      case 'AWAY':
      case '2':
      case 'AWAY_WIN':
        return probabilities.away;

      default:
        return 0;
    }
  }

  private normalizeResultProbabilities(input: {
    home: number;
    draw: number;
    away: number;
  }): {
    home: number;
    draw: number;
    away: number;
  } {
    const home = this.clamp(input.home, 0, 1);

    const draw = this.clamp(input.draw, 0, 1);

    const away = this.clamp(input.away, 0, 1);

    const total = home + draw + away;

    if (total <= 0) {
      return {
        home: 0,
        draw: 0,
        away: 0,
      };
    }

    return {
      home: home / total,
      draw: draw / total,
      away: away / total,
    };
  }

  private calculateReliability(
    sampleSize: number,
    dataQuality: number,
  ): number {
    const sampleReliability = 1 - Math.exp(-sampleSize / 20);

    return this.clamp(
      sampleReliability * 0.45 + (dataQuality / 100) * 0.55,
      0,
      1,
    );
  }

  private pushRate(values: number[], source: unknown, keys: string[]): void {
    const value = this.readRate(source, keys);

    if (value !== null) {
      values.push(value);
    }
  }

  private readRate(source: unknown, keys: string[]): number | null {
    if (!source || typeof source !== 'object') {
      return null;
    }

    const record = source as Record<string, unknown>;

    for (const key of keys) {
      const value = record[key];

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        continue;
      }

      const normalized = value > 1 && value <= 100 ? value / 100 : value;

      if (normalized >= 0 && normalized <= 1) {
        return normalized;
      }
    }

    return null;
  }

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(minimum, value), maximum);
  }
}
