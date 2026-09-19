// src/predictions-engine/engines/probability/handicap-market.engine.ts

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

    const goalProductionHome = this.clamp(
      input.features.comparison?.goalProduction?.home ?? 0,
      0,
      1,
    );

    const goalProductionAway = this.clamp(
      input.features.comparison?.goalProduction?.away ?? 0,
      0,
      1,
    );

    const goalPreventionHome = this.clamp(
      input.features.comparison?.goalPrevention?.home ?? 0,
      0,
      1,
    );

    const goalPreventionAway = this.clamp(
      input.features.comparison?.goalPrevention?.away ?? 0,
      0,
      1,
    );

    /*
     * Handicap probability comes directly from the score-margin
     * distribution.
     *
     * Comparison evidence is retained as diagnostic information only.
     * It does not modify the probability because the underlying team
     * evidence is already represented in the goal model.
     */
    const probability = this.clamp(outcome.probability, 0, 1);

    return {
      market: input.market,

      selection: input.selection,

      probability,

      supportingProbability: probability,

      sampleSize,

      dataQuality,

      modelReliability: this.calculateReliability(sampleSize, dataQuality),

      modelName: 'raw-handicap-model',

      /*
       * New version because handicap probability is now derived
       * directly from the score-margin distribution.
       */
      modelVersion: 'raw-handicap-v5',

      modelOutputs: {
        winProbability: outcome.winProbability,

        pushProbability: outcome.pushProbability,

        lossProbability: outcome.lossProbability,

        matrixProbability: probability,
      },

      modelSignals: {
        winProbability: outcome.winProbability,

        pushProbability: outcome.pushProbability,

        lossProbability: outcome.lossProbability,

        matrixProbability: probability,

        comparisonConfidence,

        directionalDifference,

        goalProductionHome,

        goalProductionAway,

        goalPreventionHome,

        goalPreventionAway,
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
      return this.emptyOutcome();
    }

    if (this.isQuarterLine(parsed.line)) {
      return this.calculateQuarterAsianHandicap(
        parsed.outcome,
        parsed.line,
        model,
      );
    }

    return this.calculateAsianHandicapWholeOrHalf(
      parsed.outcome,
      parsed.line,
      model,
    );
  }

  private calculateQuarterAsianHandicap(
    outcome: 'HOME' | 'AWAY',
    line: number,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): {
    probability: number;

    winProbability: number;

    pushProbability: number;

    lossProbability: number;
  } {
    const lowerLine = Math.floor(line * 2) / 2;

    const upperLine = Math.ceil(line * 2) / 2;

    const first = this.calculateAsianHandicapWholeOrHalf(
      outcome,
      lowerLine,
      model,
    );

    const second = this.calculateAsianHandicapWholeOrHalf(
      outcome,
      upperLine,
      model,
    );

    /*
     * Quarter Asian lines represent an equal split between the
     * adjacent half/whole lines.
     *
     * Therefore each settlement component is averaged.
     */
    const winProbability = this.clamp(
      (first.winProbability + second.winProbability) / 2,
      0,
      1,
    );

    const pushProbability = this.clamp(
      (first.pushProbability + second.pushProbability) / 2,
      0,
      1,
    );

    const lossProbability = this.clamp(
      (first.lossProbability + second.lossProbability) / 2,
      0,
      1,
    );

    return {
      /*
       * Probability means the actual probability of winning the
       * selected Asian handicap, not win conditional on avoiding
       * a push.
       */
      probability: winProbability,

      winProbability,

      pushProbability,

      lossProbability,
    };
  }

  private calculateAsianHandicapWholeOrHalf(
    outcome: 'HOME' | 'AWAY',
    line: number,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): {
    probability: number;

    winProbability: number;

    pushProbability: number;

    lossProbability: number;
  } {
    let win = 0;

    let push = 0;

    let loss = 0;

    for (let homeGoals = 0; homeGoals < model.matrix.length; homeGoals += 1) {
      const row = model.matrix[homeGoals] ?? [];

      for (let awayGoals = 0; awayGoals < row.length; awayGoals += 1) {
        const probability = row[awayGoals] ?? 0;

        if (probability <= 0) {
          continue;
        }

        const margin = homeGoals - awayGoals;

        const adjusted = outcome === 'HOME' ? margin + line : -margin + line;

        if (adjusted > 0) {
          win += probability;
        } else if (adjusted < 0) {
          loss += probability;
        } else {
          push += probability;
        }
      }
    }

    return this.buildAsianOutcome(win, push, loss);
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
      return this.emptyOutcome();
    }

    let home = 0;

    let draw = 0;

    let away = 0;

    for (let homeGoals = 0; homeGoals < model.matrix.length; homeGoals += 1) {
      const row = model.matrix[homeGoals] ?? [];

      for (let awayGoals = 0; awayGoals < row.length; awayGoals += 1) {
        const probability = row[awayGoals] ?? 0;

        if (probability <= 0) {
          continue;
        }

        const margin = homeGoals - awayGoals;

        let difference: number;

        if (parsed.outcome === 'HOME') {
          difference = margin + parsed.line;
        } else if (parsed.outcome === 'AWAY') {
          difference = -margin + parsed.line;
        } else {
          /*
           * For the European draw selection, the handicap is applied
           * to the home-vs-away margin and the resulting zero defines
           * the adjusted draw.
           */
          difference = margin + parsed.line;
        }

        if (difference > 0) {
          home += probability;
        } else if (difference < 0) {
          away += probability;
        } else {
          draw += probability;
        }
      }
    }

    const selected =
      parsed.outcome === 'HOME'
        ? home
        : parsed.outcome === 'DRAW'
          ? draw
          : away;

    const loss =
      parsed.outcome === 'HOME'
        ? draw + away
        : parsed.outcome === 'DRAW'
          ? home + away
          : home + draw;

    /*
     * European handicap has no push settlement. The selected outcome
     * is therefore the direct market probability.
     */
    return {
      probability: this.clamp(selected, 0, 1),

      winProbability: this.clamp(selected, 0, 1),

      pushProbability: 0,

      lossProbability: this.clamp(loss, 0, 1),
    };
  }

  private buildAsianOutcome(
    win: number,
    push: number,
    loss: number,
  ): {
    probability: number;

    winProbability: number;

    pushProbability: number;

    lossProbability: number;
  } {
    const winProbability = this.clamp(win, 0, 1);

    const pushProbability = this.clamp(push, 0, 1);

    const lossProbability = this.clamp(loss, 0, 1);

    const total = winProbability + pushProbability + lossProbability;

    if (total <= 0 || !Number.isFinite(total)) {
      return this.emptyOutcome();
    }

    /*
     * Normalize only to protect against numerical drift from the
     * score matrix. The three probabilities remain distinct.
     */
    const normalizedWin = winProbability / total;

    const normalizedPush = pushProbability / total;

    const normalizedLoss = lossProbability / total;

    return {
      probability: normalizedWin,

      winProbability: normalizedWin,

      pushProbability: normalizedPush,

      lossProbability: normalizedLoss,
    };
  }

  private parseAsianSelection(selection: string): {
    outcome: 'HOME' | 'AWAY';

    line: number;
  } | null {
    const normalized = selection.trim().toUpperCase();

    const explicitMatch = normalized.match(
      /^(HOME|1|AWAY|2)[_: -]?([+-]?\d+(?:\.\d+)?)$/,
    );

    if (explicitMatch) {
      const outcome =
        explicitMatch[1] === 'HOME' || explicitMatch[1] === '1'
          ? 'HOME'
          : 'AWAY';

      const line = Number(explicitMatch[2]);

      if (!Number.isFinite(line)) {
        return null;
      }

      return {
        outcome,

        line,
      };
    }

    const shorthand = normalized.match(/^([+-]?\d+(?:\.\d+)?)$/);

    if (!shorthand) {
      return null;
    }

    const line = Number(shorthand[1]);

    if (!Number.isFinite(line)) {
      return null;
    }

    return {
      outcome: 'HOME',

      line,
    };
  }

  private parseEuropeanSelection(selection: string): {
    outcome: 'HOME' | 'DRAW' | 'AWAY';

    line: number;
  } | null {
    const normalized = selection.trim().toUpperCase();

    const match = normalized.match(
      /^(HOME|DRAW|AWAY|1|X|2)[_: -]?([+-]?\d+(?:\.\d+)?)$/,
    );

    if (!match) {
      return null;
    }

    const outcome =
      match[1] === 'HOME' || match[1] === '1'
        ? 'HOME'
        : match[1] === 'DRAW' || match[1] === 'X'
          ? 'DRAW'
          : 'AWAY';

    const line = Number(match[2]);

    if (!Number.isFinite(line)) {
      return null;
    }

    return {
      outcome,

      line,
    };
  }

  private isQuarterLine(line: number): boolean {
    const doubled = Math.abs(line * 2);

    return Math.abs(doubled - Math.round(doubled)) > 0.000001;
  }

  private emptyOutcome(): {
    probability: number;

    winProbability: number;

    pushProbability: number;

    lossProbability: number;
  } {
    return {
      probability: 0,

      winProbability: 0,

      pushProbability: 0,

      lossProbability: 0,
    };
  }

  private calculateReliability(
    sampleSize: number,
    dataQuality: number,
  ): number {
    const safeSampleSize = Math.max(
      Number.isFinite(sampleSize) ? sampleSize : 0,
      0,
    );

    const safeDataQuality = this.clamp(dataQuality, 0, 100);

    const sampleReliability = 1 - Math.exp(-safeSampleSize / 20);

    return this.clamp(
      sampleReliability * 0.45 + (safeDataQuality / 100) * 0.55,
      0,
      1,
    );
  }

  private clamp(value: number, minimum = 0, maximum = 1): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
