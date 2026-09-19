// src/predictions-engine/engines/probability/goal-market.engine.ts

import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';

import { MarketModel } from '../../interfaces/market-model.interface';

import { MarketModelInput } from '../../interfaces/market-model-input.interface';

import { ProbabilityModelResult } from '../../interfaces/probability-result.interface';

import { RawGoalModelUtil } from './raw-goal-model.util';

@Injectable()
export class GoalMarketEngine implements MarketModel {
  supports(market: PredictionMarket): boolean {
    return [
      PredictionMarket.OVER_UNDER,
      PredictionMarket.GOAL_RANGE,
      PredictionMarket.TEAM_TOTAL_GOALS,
    ].includes(market);
  }

  calculate(input: MarketModelInput): ProbabilityModelResult {
    const model = RawGoalModelUtil.calculate(input.features);

    /*
     * The score distribution is the authoritative probability source
     * for all goal-based markets.
     *
     * The same underlying historical evidence is already used upstream
     * to construct the team lambdas. Re-blending recent/venue/H2H goal
     * rates here would count overlapping evidence twice.
     */
    const matrixProbability = this.resolveProbability(
      input.market,
      input.selection,
      model,
    );

    /*
     * Empirical evidence is retained as a diagnostic signal only.
     *
     * It does not modify the final probability.
     */
    const empiricalEvidence = this.calculateEmpiricalEvidence(
      input,
      input.market,
      input.selection,
    );

    const probability = this.clamp(matrixProbability);

    const sampleSize = Math.max(input.features.overallSampleSize ?? 0, 0);

    const dataQuality = this.clamp(
      input.features.overallDataQuality ?? 0,
      0,
      100,
    );

    const modelReliability = this.calculateReliability(sampleSize, dataQuality);

    const empiricalProbability = empiricalEvidence.available
      ? empiricalEvidence.probability
      : undefined;

    return {
      market: input.market,

      selection: input.selection,

      probability,

      /*
       * Supporting probability is the same structural probability
       * produced from the authoritative score distribution.
       */
      supportingProbability: matrixProbability,

      sampleSize,

      dataQuality,

      modelReliability,

      modelName: 'raw-goal-model',

      /*
       * Probability architecture changed:
       * final goal-market probability now comes directly from the
       * coherent score distribution rather than a secondary empirical
       * reconciliation.
       */
      modelVersion: 'raw-goal-v5',

      modelOutputs: {
        expectedHomeGoals: model.expectedHomeGoals,

        expectedAwayGoals: model.expectedAwayGoals,

        expectedTotalGoals: model.expectedTotalGoals,

        matrixProbability,

        ...(empiricalProbability !== undefined
          ? {
              empiricalProbability,
            }
          : {}),
      },

      modelSignals: {
        expectedHomeGoals: model.expectedHomeGoals,

        expectedAwayGoals: model.expectedAwayGoals,

        expectedTotalGoals: model.expectedTotalGoals,

        matrixProbability,

        /*
         * Diagnostic only. This value is not used to alter probability.
         */
        empiricalProbability: empiricalProbability ?? -1,

        empiricalEvidenceWeight: empiricalEvidence.weight,

        empiricalEvidenceAvailable: empiricalEvidence.available ? 1 : 0,

        comparisonConfidence: this.clamp(
          input.features.comparison?.confidence ?? 0,
          0,
          1,
        ),

        directionalDifference: this.clamp(
          input.features.comparison?.directionalDifference ?? 0,
          -1,
          1,
        ),

        goalProductionHome: this.clamp(
          input.features.comparison?.goalProduction?.home ?? 0,
          0,
          1,
        ),

        goalProductionAway: this.clamp(
          input.features.comparison?.goalProduction?.away ?? 0,
          0,
          1,
        ),

        goalProductionDifference: this.clamp(
          input.features.comparison?.goalProduction?.difference ?? 0,
          -1,
          1,
        ),

        goalPreventionHome: this.clamp(
          input.features.comparison?.goalPrevention?.home ?? 0,
          0,
          1,
        ),

        goalPreventionAway: this.clamp(
          input.features.comparison?.goalPrevention?.away ?? 0,
          0,
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

  private resolveProbability(
    market: PredictionMarket,
    selection: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    switch (market) {
      case PredictionMarket.OVER_UNDER:
        return this.resolveOverUnder(selection, model.totalGoalProbabilities);

      case PredictionMarket.GOAL_RANGE:
        return this.resolveGoalRange(selection, model.totalGoalProbabilities);

      case PredictionMarket.TEAM_TOTAL_GOALS:
        return this.resolveTeamTotal(selection, model);

      default:
        return 0;
    }
  }

  private calculateEmpiricalEvidence(
    input: MarketModelInput,
    market: PredictionMarket,
    selection: string,
  ): {
    probability: number;
    weight: number;
    available: boolean;
  } {
    if (market === PredictionMarket.TEAM_TOTAL_GOALS) {
      return this.calculateTeamTotalEmpiricalEvidence(input, selection);
    }

    if (market === PredictionMarket.OVER_UNDER) {
      return this.calculateOverUnderEmpiricalEvidence(input, selection);
    }

    if (market === PredictionMarket.GOAL_RANGE) {
      return this.calculateGoalRangeEmpiricalEvidence(input, selection);
    }

    return {
      probability: 0,
      weight: 0,
      available: false,
    };
  }

  private calculateOverUnderEmpiricalEvidence(
    input: MarketModelInput,
    selection: string,
  ): {
    probability: number;
    weight: number;
    available: boolean;
  } {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(OVER|UNDER)[_:\s-]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return {
        probability: 0,
        weight: 0,
        available: false,
      };
    }

    const side = match[1];

    const line = Number(match[2]);

    if (!Number.isFinite(line) || line < 0) {
      return {
        probability: 0,
        weight: 0,
        available: false,
      };
    }

    const overKey = this.getOverRateKey(line);

    if (!overKey) {
      return {
        probability: 0,
        weight: 0,
        available: false,
      };
    }

    const sources: unknown[] = [
      input.features.home?.recent,
      input.features.away?.recent,
      input.features.home?.venue,
      input.features.away?.venue,
      input.features.h2h,
    ];

    const observations = this.collectEmpiricalValues(
      sources,
      overKey,
      side === 'OVER' ? false : true,
    );

    return this.buildEmpiricalEvidence(observations, input);
  }

  private calculateGoalRangeEmpiricalEvidence(
    input: MarketModelInput,
    selection: string,
  ): {
    probability: number;
    weight: number;
    available: boolean;
  } {
    const normalized = selection.trim().toUpperCase().replace(/\s+/g, '');

    const prefixed = normalized.match(
      /^(?:GOALS?|TOTAL_GOALS?|TOTALGOALS?)[_:\s-]?(.+)$/,
    );

    const value = prefixed ? prefixed[1] : normalized;

    const values: Array<{
      probability: number;
      observations: number;
    }> = [];

    const sources: unknown[] = [
      input.features.home?.recent,
      input.features.away?.recent,
      input.features.home?.venue,
      input.features.away?.venue,
      input.features.h2h,
    ];

    /*
     * Convert cumulative over-rates into mutually exclusive ranges:
     *
     * 0-1 = 1 - O1.5
     * 2   = O1.5 - O2.5
     * 3-4 = O2.5 - O4.5
     * 5+  = O4.5
     *
     * Only internally coherent cumulative rates are accepted.
     */
    for (const source of sources) {
      const observations = this.readSampleSize(source);

      if (observations <= 0) {
        continue;
      }

      if (/^0-1$/.test(value)) {
        const over15 = this.readRate(source, ['over15Rate']);

        if (over15 !== null) {
          values.push({
            probability: this.clamp(1 - over15),
            observations,
          });
        }

        continue;
      }

      if (value === '2') {
        const over15 = this.readRate(source, ['over15Rate']);

        const over25 = this.readRate(source, ['over25Rate']);

        if (over15 !== null && over25 !== null && over15 >= over25) {
          values.push({
            probability: this.clamp(over15 - over25),
            observations,
          });
        }

        continue;
      }

      if (value === '3-4') {
        const over25 = this.readRate(source, ['over25Rate']);

        const over45 = this.readRate(source, ['over45Rate']);

        if (over25 !== null && over45 !== null && over25 >= over45) {
          values.push({
            probability: this.clamp(over25 - over45),
            observations,
          });
        }

        continue;
      }

      if (value === '5+') {
        const over45 = this.readRate(source, ['over45Rate']);

        if (over45 !== null) {
          values.push({
            probability: this.clamp(over45),
            observations,
          });
        }
      }
    }

    return this.buildEmpiricalEvidence(values, input);
  }

  private calculateTeamTotalEmpiricalEvidence(
    input: MarketModelInput,
    selection: string,
  ): {
    probability: number;
    weight: number;
    available: boolean;
  } {
    const match = selection
      .trim()
      .toUpperCase()
      .match(/^(HOME|AWAY)[_:\s-]?(OVER|UNDER)[_:\s-]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return {
        probability: 0,
        weight: 0,
        available: false,
      };
    }

    const team = match[1];

    const side = match[2];

    const line = Number(match[3]);

    if (!Number.isFinite(line) || line < 0) {
      return {
        probability: 0,
        weight: 0,
        available: false,
      };
    }

    const selectedTeam =
      team === 'HOME' ? input.features.home : input.features.away;

    const sources: unknown[] = [selectedTeam?.recent, selectedTeam?.venue];

    const overKey = this.getOverRateKey(line);

    if (!overKey) {
      return {
        probability: 0,
        weight: 0,
        available: false,
      };
    }

    const observations = this.collectEmpiricalValues(
      sources,
      overKey,
      side === 'OVER' ? false : true,
    );

    return this.buildEmpiricalEvidence(observations, input);
  }

  private buildEmpiricalEvidence(
    values: Array<{
      probability: number;
      observations: number;
    }>,
    input: MarketModelInput,
  ): {
    probability: number;
    weight: number;
    available: boolean;
  } {
    if (values.length === 0) {
      return {
        probability: 0,
        weight: 0,
        available: false,
      };
    }

    let weightedProbability = 0;

    let totalObservationWeight = 0;

    let totalObservations = 0;

    for (const entry of values) {
      const observations = Math.max(Math.floor(entry.observations), 1);

      const reliability = this.clamp(1 - Math.exp(-observations / 20), 0, 1);

      const effectiveWeight = Math.max(observations * reliability, 1);

      weightedProbability += entry.probability * effectiveWeight;

      totalObservationWeight += effectiveWeight;

      totalObservations += observations;
    }

    if (totalObservationWeight <= 0) {
      return {
        probability: 0,
        weight: 0,
        available: false,
      };
    }

    const probability = this.clamp(
      weightedProbability / totalObservationWeight,
    );

    /*
     * This is diagnostic evidence strength only.
     *
     * It is deliberately not used to modify the final probability.
     */
    const sampleReliability = this.clamp(
      1 - Math.exp(-totalObservations / 40),
      0,
      1,
    );

    const dataReliability = this.clamp(
      (input.features.overallDataQuality ?? 0) / 100,
      0,
      1,
    );

    const weight = this.clamp(
      (sampleReliability * 0.6 + dataReliability * 0.4) * 0.3,
      0,
      0.3,
    );

    return {
      probability,

      weight,

      available: true,
    };
  }

  private collectEmpiricalValues(
    sources: unknown[],
    rateKey: string,
    complement: boolean,
  ): Array<{
    probability: number;
    observations: number;
  }> {
    const values: Array<{
      probability: number;
      observations: number;
    }> = [];

    for (const source of sources) {
      const observations = this.readSampleSize(source);

      if (observations <= 0) {
        continue;
      }

      const rate = this.readRate(source, [rateKey]);

      if (rate === null) {
        continue;
      }

      values.push({
        probability: complement ? this.clamp(1 - rate) : rate,

        observations,
      });
    }

    return values;
  }

  private readSampleSize(source: unknown): number {
    if (!source || typeof source !== 'object') {
      return 0;
    }

    const record = source as Record<string, unknown>;

    const possibleKeys = ['sampleSize', 'matchesAnalyzed', 'played', 'matches'];

    for (const key of possibleKeys) {
      const value = record[key];

      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.floor(value);
      }
    }

    return 0;
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

  private getOverRateKey(line: number): string | null {
    if (!Number.isFinite(line) || line < 0) {
      return null;
    }

    switch (line) {
      case 0.5:
        return 'over05Rate';

      case 1.5:
        return 'over15Rate';

      case 2.5:
        return 'over25Rate';

      case 3.5:
        return 'over35Rate';

      case 4.5:
        return 'over45Rate';

      case 5.5:
        return 'over55Rate';

      default:
        return null;
    }
  }

  private resolveOverUnder(selection: string, probabilities: number[]): number {
    const normalized = selection.trim().toUpperCase();

    const match = normalized.match(/^(OVER|UNDER)[_:\s-]?(\d+(?:\.\d+)?)$/);

    if (!match) {
      return 0;
    }

    const side = match[1];

    const line = Number(match[2]);

    if (!Number.isFinite(line) || line < 0) {
      return 0;
    }

    return side === 'OVER'
      ? this.probabilityOver(probabilities, line)
      : this.probabilityUnder(probabilities, line);
  }

  private resolveGoalRange(selection: string, probabilities: number[]): number {
    const normalized = selection.trim().toUpperCase().replace(/\s+/g, '');

    const prefixed = normalized.match(
      /^(?:GOALS?|TOTAL_GOALS?|TOTALGOALS?)[_:\s-]?(.+)$/,
    );

    const value = prefixed ? prefixed[1] : normalized;

    if (/^\d+$/.test(value)) {
      const goals = Number(value);

      return Number.isFinite(goals)
        ? this.probabilityExactly(probabilities, goals)
        : 0;
    }

    const atLeastMatch = value.match(/^(\d+)\+$/);

    if (atLeastMatch) {
      const minimum = Number(atLeastMatch[1]);

      if (!Number.isFinite(minimum) || minimum < 0) {
        return 0;
      }

      return this.probabilityAtLeast(probabilities, minimum);
    }

    const rangeMatch = value.match(/^(\d+)-(\d+)$/);

    if (!rangeMatch) {
      return 0;
    }

    const minimum = Number(rangeMatch[1]);

    const maximum = Number(rangeMatch[2]);

    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum < 0 ||
      maximum < 0 ||
      minimum > maximum
    ) {
      return 0;
    }

    return this.clamp(
      probabilities.reduce(
        (sum, probability, goals) =>
          goals >= minimum && goals <= maximum ? sum + probability : sum,
        0,
      ),
    );
  }

  private resolveTeamTotal(
    selection: string,
    model: ReturnType<typeof RawGoalModelUtil.calculate>,
  ): number {
    const normalized = selection.trim().toUpperCase();

    const match = normalized.match(
      /^(HOME|AWAY)[_:\s-]?(OVER|UNDER)[_:\s-]?(\d+(?:\.\d+)?)$/,
    );

    if (!match) {
      return 0;
    }

    const team = match[1];

    const side = match[2];

    const line = Number(match[3]);

    if (!Number.isFinite(line) || line < 0) {
      return 0;
    }

    const probabilities =
      team === 'HOME'
        ? model.homeGoalProbabilities
        : model.awayGoalProbabilities;

    return side === 'OVER'
      ? this.probabilityOver(probabilities, line)
      : this.probabilityUnder(probabilities, line);
  }

  private probabilityOver(probabilities: number[], line: number): number {
    return this.clamp(
      probabilities.reduce(
        (sum, probability, goals) => (goals > line ? sum + probability : sum),
        0,
      ),
    );
  }

  private probabilityUnder(probabilities: number[], line: number): number {
    return this.clamp(
      probabilities.reduce(
        (sum, probability, goals) => (goals < line ? sum + probability : sum),
        0,
      ),
    );
  }

  private probabilityExactly(probabilities: number[], goals: number): number {
    if (goals < 0 || goals >= probabilities.length) {
      return 0;
    }

    return this.clamp(probabilities[goals] ?? 0);
  }

  private probabilityAtLeast(probabilities: number[], goals: number): number {
    if (goals <= 0) {
      return 1;
    }

    if (goals >= probabilities.length) {
      return 0;
    }

    return this.clamp(
      probabilities.reduce(
        (sum, probability, index) => (index >= goals ? sum + probability : sum),
        0,
      ),
    );
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
      sampleReliability * 0.4 + (safeDataQuality / 100) * 0.6,
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
