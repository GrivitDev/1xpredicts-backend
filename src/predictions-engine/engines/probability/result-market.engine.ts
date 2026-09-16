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

    const goalProductionDifference = this.clamp(
      input.features.comparison?.goalProduction?.difference ?? 0,
      -1,
      1,
    );

    const goalPreventionDifference = this.clamp(
      input.features.comparison?.goalPrevention?.difference ?? 0,
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

        goalProductionDifference,

        goalPreventionDifference,
      },
    };
  }

  private calculateComparisonDistribution(input: MarketModelInput): {
    home: number;
    draw: number;
    away: number;
  } {
    const comparison = input.features.comparison;

    /*
     * Without comparison evidence there is no independent
     * comparison distribution to add.
     */
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

    const goalProductionDifference = this.clamp(
      comparison.goalProduction?.difference ?? 0,
      -1,
      1,
    );

    const goalPreventionDifference = this.clamp(
      comparison.goalPrevention?.difference ?? 0,
      -1,
      1,
    );

    /*
     * ----------------------------------------------------------
     * DRAW EVIDENCE
     * ----------------------------------------------------------
     *
     * Draw evidence must come from actual draw history.
     * Similar team strength may modify the result slightly, but
     * similarity itself does not create a draw prediction.
     */
    const drawEvidence = this.calculateDrawEvidence(input);

    /*
     * ----------------------------------------------------------
     * GOAL / RESULT DIRECTION
     * ----------------------------------------------------------
     *
     * Directional difference is the primary result-direction
     * signal.
     *
     * Goal production and prevention provide secondary support:
     *
     *   stronger home production
     *   + weaker home prevention
     *
     * supports HOME.
     *
     * The corresponding inverse supports AWAY.
     */
    const productionSignal = goalProductionDifference;

    const preventionSignal = -goalPreventionDifference;

    const goalDirectionalSignal = this.clamp(
      (productionSignal + preventionSignal) / 2,
      -1,
      1,
    );

    /*
     * Blend result direction from the direct result signal and
     * the actual scoring/prevention evidence.
     */
    const directionalEvidence = this.clamp(
      directionalDifference * 0.6 + goalDirectionalSignal * 0.4,
      -1,
      1,
    );

    /*
     * Comparison confidence controls how strongly the comparison
     * model is allowed to move away from 50/50.
     *
     * No comparison-confidence inflation occurs here.
     */
    const directionalStrength = Math.abs(directionalEvidence);

    const directionalFactor = this.clamp(
      comparisonConfidence * (0.55 + directionalStrength * 0.45),
      0,
      1,
    );

    const homeSignal = this.clamp(0.5 + directionalEvidence * 0.5, 0, 1);

    const homeShare = this.clamp(
      0.5 + (homeSignal - 0.5) * directionalFactor,
      0,
      1,
    );

    const awayShare = this.clamp(1 - homeShare, 0, 1);

    /*
     * ----------------------------------------------------------
     * DRAW SHARE
     * ----------------------------------------------------------
     *
     * There is NO artificial 25% draw fallback.
     *
     * When actual draw evidence is unavailable, the comparison
     * model keeps only a small neutral draw component instead of
     * fabricating evidence.
     */
    let drawWeight = 0.2;

    if (drawEvidence.available) {
      const similarity = this.clamp(1 - Math.abs(directionalEvidence), 0, 1);

      /*
       * Actual draw evidence is dominant.
       * Similar strength only provides a modest modifier.
       */
      const drawEvidenceStrength = this.clamp(
        drawEvidence.value * 0.85 + similarity * 0.15 * comparisonConfidence,
        0,
        1,
      );

      drawWeight = this.clamp(
        drawEvidenceStrength * (0.35 + comparisonConfidence * 0.25),
        0.05,
        0.45,
      );
    }

    const nonDrawWeight = this.clamp(1 - drawWeight, 0, 1);

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
     * The comparison model can challenge the goal matrix only
     * when comparison evidence is actually present.
     *
     * Maximum comparison influence remains bounded at 40%.
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

    return Math.min(Math.max(value, minimum), maximum);
  }
}
