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

    const matrixOutcome =
      input.market === PredictionMarket.ASIAN_HANDICAP
        ? this.calculateAsianHandicap(input.selection, model)
        : this.calculateEuropeanHandicap(input.selection, model);

    const comparisonProbability = this.calculateComparisonProbability(
      input,
      input.selection,
      input.market,
    );

    const probability = this.reconcileWithComparison(
      input,
      input.selection,
      matrixOutcome.probability,
      input.market,
    );

    const outcome = this.reconcileSettlementProbabilities(
      matrixOutcome,
      probability,
    );

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

      // Keep this as the structural / raw matrix probability.
      // The reconciled probability remains the final probability above.
      supportingProbability: this.clamp(matrixOutcome.probability),

      sampleSize,
      dataQuality,
      modelReliability: this.calculateReliability(sampleSize, dataQuality),
      modelName: 'raw-handicap-model',
      modelVersion: 'raw-handicap-v4',

      modelOutputs: {
        winProbability: outcome.winProbability,
        pushProbability: outcome.pushProbability,
        lossProbability: outcome.lossProbability,
        matrixProbability: matrixOutcome.probability,
        comparisonProbability,
        directionalDifference:
          input.features.comparison?.directionalDifference ?? 0,
      },

      modelSignals: {
        winProbability: outcome.winProbability,
        pushProbability: outcome.pushProbability,
        lossProbability: outcome.lossProbability,
        matrixProbability: matrixOutcome.probability,
        comparisonProbability,
        comparisonConfidence: input.features.comparison?.confidence ?? 0,
        directionalDifference:
          input.features.comparison?.directionalDifference ?? 0,

        goalProductionHome:
          input.features.comparison?.goalProduction?.home ?? 0,
        goalProductionAway:
          input.features.comparison?.goalProduction?.away ?? 0,

        goalPreventionHome:
          input.features.comparison?.goalPrevention?.home ?? 0,
        goalPreventionAway:
          input.features.comparison?.goalPrevention?.away ?? 0,
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

        if (probability <= 0) {
          continue;
        }

        const margin = homeGoals - awayGoals;

        const adjusted =
          parsed.outcome === 'HOME'
            ? margin + parsed.line
            : -margin + parsed.line;

        if (adjusted > 0) {
          win += probability;
        } else if (adjusted < 0) {
          loss += probability;
        } else {
          push += probability;
        }
      }
    }

    return this.buildDecisiveOutcome(win, push, loss);
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

    return {
      probability: this.clamp((first.probability + second.probability) / 2),

      winProbability: this.clamp(
        (first.winProbability + second.winProbability) / 2,
      ),

      pushProbability: this.clamp(
        (first.pushProbability + second.pushProbability) / 2,
      ),

      lossProbability: this.clamp(
        (first.lossProbability + second.lossProbability) / 2,
      ),
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

    for (let homeGoals = 0; homeGoals < model.matrix.length; homeGoals++) {
      for (
        let awayGoals = 0;
        awayGoals < model.matrix[homeGoals].length;
        awayGoals++
      ) {
        const probability = model.matrix[homeGoals][awayGoals] ?? 0;

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

    return this.buildDecisiveOutcome(win, push, loss);
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

    for (let homeGoals = 0; homeGoals < model.matrix.length; homeGoals++) {
      for (
        let awayGoals = 0;
        awayGoals < model.matrix[homeGoals].length;
        awayGoals++
      ) {
        const probability = model.matrix[homeGoals][awayGoals] ?? 0;

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

    const remainder = Math.max(home + draw + away - selected, 0);

    return {
      probability: this.clamp(selected),

      winProbability:
        parsed.outcome === 'DRAW' ? this.clamp(draw) : this.clamp(selected),

      pushProbability: 0,

      lossProbability: this.clamp(remainder),
    };
  }

  private calculateComparisonProbability(
    input: MarketModelInput,
    selection: string,
    market: PredictionMarket,
  ): number {
    const comparison = input.features.comparison;

    if (!comparison) {
      return 0.5;
    }

    const directionalDifference = this.clamp(
      comparison.directionalDifference ?? 0,
      -1,
      1,
    );

    const confidence = this.clamp(comparison.confidence ?? 0);

    const parsedAsian =
      market === PredictionMarket.ASIAN_HANDICAP
        ? this.parseAsianSelection(selection)
        : null;

    const parsedEuropean =
      market === PredictionMarket.EUROPEAN_HANDICAP
        ? this.parseEuropeanSelection(selection)
        : null;

    let side: 'HOME' | 'DRAW' | 'AWAY' | null = null;

    if (parsedAsian) {
      side = parsedAsian.outcome;
    }

    if (parsedEuropean) {
      side = parsedEuropean.outcome;
    }

    if (!side) {
      return 0.5;
    }

    let baseProbability = 0.5;

    if (side === 'HOME') {
      baseProbability = 0.5 + directionalDifference * 0.5;
    } else if (side === 'AWAY') {
      baseProbability = 0.5 - directionalDifference * 0.5;
    } else {
      baseProbability = 0.5 - Math.abs(directionalDifference) * 0.25;
    }

    const confidenceWeight = this.clamp(confidence * 0.4, 0, 0.4);

    return this.clamp(0.5 + (baseProbability - 0.5) * (0.5 + confidenceWeight));
  }

  private reconcileWithComparison(
    input: MarketModelInput,
    selection: string,
    matrixProbability: number,
    market: PredictionMarket,
  ): number {
    const matrix = this.clamp(matrixProbability);

    const comparison = this.calculateComparisonProbability(
      input,
      selection,
      market,
    );

    const comparisonConfidence = this.clamp(
      input.features.comparison?.confidence ?? 0,
    );

    const dataQuality = this.clamp(
      (input.features.overallDataQuality ?? 0) / 100,
    );

    const evidenceAvailable = Boolean(input.features.comparison);

    if (!evidenceAvailable) {
      return matrix;
    }

    const weight = this.clamp(
      (comparisonConfidence * 0.6 + dataQuality * 0.4) * 0.25,
      0,
      0.25,
    );

    return this.clamp(matrix * (1 - weight) + comparison * weight);
  }

  private reconcileSettlementProbabilities(
    matrixOutcome: {
      probability: number;
      winProbability: number;
      pushProbability: number;
      lossProbability: number;
    },
    reconciledProbability: number,
  ): {
    probability: number;
    winProbability: number;
    pushProbability: number;
    lossProbability: number;
  } {
    const originalWin = this.clamp(matrixOutcome.winProbability);

    const originalPush = this.clamp(matrixOutcome.pushProbability);

    const originalLoss = this.clamp(matrixOutcome.lossProbability);

    const originalDecisive = originalWin + originalLoss;

    if (originalDecisive <= 0) {
      return {
        probability: this.clamp(reconciledProbability),
        winProbability: 0,
        pushProbability: originalPush,
        lossProbability: 0,
      };
    }

    const target = this.clamp(reconciledProbability);

    const originalWinRate = originalWin / originalDecisive;

    const decisiveAdjustment = target - originalWinRate;

    const win = this.clamp(originalWin + decisiveAdjustment * originalDecisive);

    const loss = this.clamp(
      originalLoss - decisiveAdjustment * originalDecisive,
    );

    return {
      probability: this.clamp(win / Math.max(win + loss, Number.EPSILON)),

      winProbability: win,
      pushProbability: originalPush,
      lossProbability: loss,
    };
  }

  private buildDecisiveOutcome(
    win: number,
    push: number,
    loss: number,
  ): {
    probability: number;
    winProbability: number;
    pushProbability: number;
    lossProbability: number;
  } {
    const normalizedWin = this.clamp(win);
    const normalizedPush = this.clamp(push);
    const normalizedLoss = this.clamp(loss);

    const decisive = normalizedWin + normalizedLoss;

    return {
      probability: decisive > 0 ? this.clamp(normalizedWin / decisive) : 0,

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
