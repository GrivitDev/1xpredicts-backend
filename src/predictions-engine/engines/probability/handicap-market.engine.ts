import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';

import { MarketModel } from '../../interfaces/market-model.interface';

import { MarketModelInput } from '../../interfaces/market-model-input.interface';

import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';

import { RawGoalModelUtil } from './raw-goal-model.util';

@Injectable()
export class HandicapMarketEngine implements MarketModel {
  supports(market: PredictionMarket): boolean {
    return [
      PredictionMarket.ASIAN_HANDICAP,
      PredictionMarket.EUROPEAN_HANDICAP,
    ].includes(market);
  }

  calculate(input: MarketModelInput): ProbabilityModelResult {
    const model = RawGoalModelUtil.calculate(input.features);

    const outcome =
      input.market === PredictionMarket.ASIAN_HANDICAP
        ? this.calculateAsianHandicap(input.selection, model)
        : this.calculateEuropeanHandicap(input.selection, model);

    const sampleSize = Math.max(input.features.overallSampleSize ?? 0, 0);

    const dataQuality = this.clamp(
      input.features.overallDataQuality ?? 0,
      0,
      100,
    );

    return {
      market: input.market,
      selection: input.selection,
      probability: outcome.probability,
      supportingProbability: outcome.probability,
      sampleSize,
      dataQuality,
      modelReliability: this.calculateReliability(sampleSize, dataQuality),
      modelName: 'raw-handicap-model',
      modelVersion: 'raw-handicap-v2',
      modelOutputs: {
        winProbability: outcome.winProbability,
        pushProbability: outcome.pushProbability,
        lossProbability: outcome.lossProbability,
      },
      modelSignals: {
        winProbability: outcome.winProbability,
        pushProbability: outcome.pushProbability,
        lossProbability: outcome.lossProbability,
      },
    };
  }

  private calculateAsianHandicap(
    selection: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): {
    probability: number;
    winProbability: number;
    pushProbability: number;
    lossProbability: number;
  } {
    const parsed = this.parseAsianSelection(selection);

    if (!parsed) {
      return {
        probability: 0,
        winProbability: 0,
        pushProbability: 0,
        lossProbability: 0,
      };
    }

    let win = 0;
    let push = 0;
    let loss = 0;

    for (let homeGoals = 0; homeGoals < model.matrix.length; homeGoals++) {
      for (
        let awayGoals = 0;
        awayGoals < model.matrix[homeGoals].length;
        awayGoals++
      ) {
        const probability = model.matrix[homeGoals][awayGoals] ?? 0;

        const adjusted = homeGoals - awayGoals + parsed.line;

        if (adjusted > 0) {
          win += probability;
        } else if (adjusted < 0) {
          loss += probability;
        } else {
          push += probability;
        }
      }
    }

    const decisive = win + loss;

    const probability = decisive > 0 ? win / decisive : 0;

    return {
      probability: this.clamp(probability),
      winProbability: this.clamp(win),
      pushProbability: this.clamp(push),
      lossProbability: this.clamp(loss),
    };
  }

  private calculateEuropeanHandicap(
    selection: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): {
    probability: number;
    winProbability: number;
    pushProbability: number;
    lossProbability: number;
  } {
    const parsed = this.parseEuropeanSelection(selection);

    if (!parsed) {
      return {
        probability: 0,
        winProbability: 0,
        pushProbability: 0,
        lossProbability: 0,
      };
    }

    let win = 0;
    let push = 0;
    let loss = 0;

    for (let homeGoals = 0; homeGoals < model.matrix.length; homeGoals++) {
      for (
        let awayGoals = 0;
        awayGoals < model.matrix[homeGoals].length;
        awayGoals++
      ) {
        const probability = model.matrix[homeGoals][awayGoals] ?? 0;

        const difference = homeGoals + parsed.line - awayGoals;

        if (difference > 0) {
          if (parsed.outcome === 'HOME') {
            win += probability;
          } else {
            loss += probability;
          }

          continue;
        }

        if (difference < 0) {
          if (parsed.outcome === 'AWAY') {
            win += probability;
          } else {
            loss += probability;
          }

          continue;
        }

        if (parsed.outcome === 'DRAW') {
          win += probability;
        } else {
          push += probability;
        }
      }
    }

    return {
      probability: this.clamp(win),
      winProbability: this.clamp(win),
      pushProbability: this.clamp(push),
      lossProbability: this.clamp(loss),
    };
  }

  private parseAsianSelection(selection: string): { line: number } | null {
    const normalized = selection.trim().toUpperCase();

    /*
     * Supports:
     *
     * HOME_-2
     * HOME_-1.5
     * HOME_0
     * HOME_1.5
     * 1_-1.5
     * -1.5
     */
    const match = normalized.match(/^(?:HOME|1)[_: -]?([+-]?\d+(?:\.\d+)?)$/);

    if (match) {
      const line = Number(match[1]);

      return Number.isFinite(line) ? { line } : null;
    }

    const shorthand = normalized.match(/^([+-]?\d+(?:\.\d+)?)$/);

    if (!shorthand) {
      return null;
    }

    const line = Number(shorthand[1]);

    return Number.isFinite(line) ? { line } : null;
  }

  private parseEuropeanSelection(selection: string): {
    outcome: 'HOME' | 'DRAW' | 'AWAY';
    line: number;
  } | null {
    const normalized = selection.trim().toUpperCase();

    const match = normalized.match(
      /^(HOME|DRAW|AWAY)[_: -]?([+-]?\d+(?:\.\d+)?)$/,
    );

    if (!match) {
      return null;
    }

    const outcome = match[1] as 'HOME' | 'DRAW' | 'AWAY';

    const line = Number(match[2]);

    if (!Number.isFinite(line)) {
      return null;
    }

    return {
      outcome,
      line,
    };
  }

  private calculateReliability(
    sampleSize: number,
    dataQuality: number,
  ): number {
    const sampleReliability = 1 - Math.exp(-sampleSize / 20);

    return this.clamp(sampleReliability * 0.45 + (dataQuality / 100) * 0.55);
  }

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
