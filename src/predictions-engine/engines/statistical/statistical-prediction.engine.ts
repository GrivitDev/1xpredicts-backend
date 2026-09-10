import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
import { FixtureAnalysis } from '../../interfaces/fixture-analysis.interface';
import { StatisticalModelOutput } from '../../interfaces/statistical-model.interface';
import { StatisticalMarketResult } from '../../interfaces/statistical-market-result.interface';

import { HalfGoalDistributionService } from '../../services/half-goal-distribution.service';

import { AsianHandicapMarket } from '../../markets/asian-handicap.market';
import { BttsGoalsMarket } from '../../markets/btts-goals.market';
import { CleanSheetMarket } from '../../markets/clean-sheet.market';
import { DoubleChanceMarket } from '../../markets/double-chance.market';
import { DrawNoBetMarket } from '../../markets/draw-no-bet.market';
import { EuropeanHandicapMarket } from '../../markets/european-handicap.market';
import { FirstHalfGoalsMarket } from '../../markets/first-half-goals.market';
import { GoalRangeMarket } from '../../markets/goal-range.market';
import { SecondHalfGoalsMarket } from '../../markets/second-half-goals.market';
import { TeamTotalGoalsMarket } from '../../markets/team-total-goals.market';

import { GoalsMarketEngine } from './goals-market.engine';
import { BttsMarketEngine } from './btts-market.engine';
import { GoalModelEngine } from './goal-model.engine';
import { MatchResultEngine } from './match-result.engine';

@Injectable()
export class StatisticalPredictionEngine {
  constructor(
    private readonly goalModelEngine: GoalModelEngine,
    private readonly matchResultEngine: MatchResultEngine,
    private readonly goalsMarketEngine: GoalsMarketEngine,
    private readonly bttsMarketEngine: BttsMarketEngine,

    private readonly bttsGoalsMarket: BttsGoalsMarket,
    private readonly doubleChanceMarket: DoubleChanceMarket,
    private readonly drawNoBetMarket: DrawNoBetMarket,
    private readonly goalRangeMarket: GoalRangeMarket,
    private readonly teamTotalGoalsMarket: TeamTotalGoalsMarket,
    private readonly cleanSheetMarket: CleanSheetMarket,
    private readonly firstHalfGoalsMarket: FirstHalfGoalsMarket,
    private readonly secondHalfGoalsMarket: SecondHalfGoalsMarket,
    private readonly asianHandicapMarket: AsianHandicapMarket,
    private readonly europeanHandicapMarket: EuropeanHandicapMarket,

    private readonly halfGoalDistributionService: HalfGoalDistributionService,
  ) {}

  async generate(fixtureAnalysis: FixtureAnalysis): Promise<
    StatisticalModelOutput & {
      marketResults: StatisticalMarketResult[];
    }
  > {
    const modelOutput = this.goalModelEngine.build(fixtureAnalysis);

    /*
     * ----------------------------------------------------------
     * CORE MATCH PROBABILITIES
     * ----------------------------------------------------------
     */

    const matchProbability = this.matchResultEngine.calculate(
      modelOutput.goalDistribution,
    );

    const marketResults: StatisticalMarketResult[] = [];

    /*
     * ----------------------------------------------------------
     * MARKET RESULT BUILDER
     * ----------------------------------------------------------
     */

    const addMarket = (
      market: PredictionMarket,
      selections: Array<{
        market: PredictionMarket;
        selection: string;
        label: string;
        probability: number;
      }>,
    ): void => {
      if (!selections.length) {
        return;
      }

      marketResults.push({
        market,
        selections: selections
          .filter(
            (selection) =>
              typeof selection.selection === 'string' &&
              Number.isFinite(selection.probability),
          )
          .map((selection) => ({
            market: selection.market,
            selection: selection.selection,
            label: selection.label,
            probability: this.clamp(selection.probability),
          })),
      });
    };

    /*
     * ----------------------------------------------------------
     * 1. OVER / UNDER
     * ----------------------------------------------------------
     */

    addMarket(
      PredictionMarket.OVER_UNDER,
      this.goalsMarketEngine.calculateOverUnder(modelOutput.goalDistribution),
    );

    /*
     * ----------------------------------------------------------
     * 2. BOTH TEAMS TO SCORE
     * ----------------------------------------------------------
     */

    addMarket(
      PredictionMarket.BOTH_TEAMS_TO_SCORE,
      this.bttsMarketEngine.calculate(modelOutput.goalDistribution),
    );

    /*
     * ----------------------------------------------------------
     * 3. BTTS + GOALS
     * ----------------------------------------------------------
     */

    addMarket(
      PredictionMarket.BTTS_GOALS,
      this.bttsGoalsMarket.calculate(modelOutput.goalDistribution),
    );

    /*
     * ----------------------------------------------------------
     * 4. DOUBLE CHANCE
     * ----------------------------------------------------------
     */

    addMarket(
      PredictionMarket.DOUBLE_CHANCE,
      this.doubleChanceMarket.calculate(modelOutput.goalDistribution),
    );

    /*
     * ----------------------------------------------------------
     * 5. DRAW NO BET
     * ----------------------------------------------------------
     */

    addMarket(
      PredictionMarket.DRAW_NO_BET,
      this.drawNoBetMarket.calculate(modelOutput.goalDistribution),
    );

    /*
     * ----------------------------------------------------------
     * 6. GOAL RANGE
     * ----------------------------------------------------------
     */

    addMarket(
      PredictionMarket.GOAL_RANGE,
      this.goalRangeMarket.calculate(modelOutput.goalDistribution),
    );

    /*
     * ----------------------------------------------------------
     * 7. TEAM TOTAL GOALS
     * ----------------------------------------------------------
     */

    addMarket(
      PredictionMarket.TEAM_TOTAL_GOALS,
      this.teamTotalGoalsMarket.calculate(modelOutput.goalDistribution),
    );

    /*
     * ----------------------------------------------------------
     * 8. CLEAN SHEET
     * ----------------------------------------------------------
     */

    addMarket(
      PredictionMarket.CLEAN_SHEET,
      this.cleanSheetMarket.calculate(modelOutput.goalDistribution),
    );

    /*
     * ----------------------------------------------------------
     * 9. ASIAN HANDICAP
     * ----------------------------------------------------------
     */

    addMarket(
      PredictionMarket.ASIAN_HANDICAP,
      this.asianHandicapMarket
        .calculate(modelOutput.goalDistribution)
        .map((item) => ({
          market: item.market,
          selection: item.selection,
          label: item.label,
          probability: item.probability,
        })),
    );

    /*
     * ----------------------------------------------------------
     * 10. EUROPEAN HANDICAP
     * ----------------------------------------------------------
     */

    addMarket(
      PredictionMarket.EUROPEAN_HANDICAP,
      this.europeanHandicapMarket.calculate(modelOutput.goalDistribution),
    );

    /*
     * ----------------------------------------------------------
     * 11 + 12. HALF-TIME GOALS
     * ----------------------------------------------------------
     *
     * These use historical first-half / second-half data
     * from MongoDB. No provider request is made here.
     */

    const halfDistribution = await this.halfGoalDistributionService.build(
      fixtureAnalysis.fixture.competitionId,
      fixtureAnalysis.fixture.season,
      fixtureAnalysis.fixture.kickoff,
      fixtureAnalysis.fixture.homeTeam.teamId,
      fixtureAnalysis.fixture.awayTeam.teamId,
    );

    if (halfDistribution) {
      addMarket(
        PredictionMarket.FIRST_HALF_GOALS,
        this.firstHalfGoalsMarket.calculate(halfDistribution.firstHalf),
      );

      addMarket(
        PredictionMarket.SECOND_HALF_GOALS,
        this.secondHalfGoalsMarket.calculate(halfDistribution.secondHalf),
      );
    }

    /*
     * ----------------------------------------------------------
     * DATA QUALITY
     * ----------------------------------------------------------
     */

    const dataQuality = this.calculateOverallDataQuality(
      fixtureAnalysis,
      halfDistribution !== null,
    );

    const sampleQuality = this.calculateSampleQuality(
      fixtureAnalysis,
      halfDistribution,
    );

    const reasonCodes = this.buildReasonCodes(
      modelOutput.reasonCodes,
      halfDistribution !== null,
    );

    return {
      expectedGoals: modelOutput.expectedGoals,
      matchProbability,
      goalDistribution: modelOutput.goalDistribution,
      dataQuality,
      sampleQuality,
      reasonCodes,
      marketResults,
      generatedAt: new Date(),
    };
  }

  private calculateOverallDataQuality(
    fixtureAnalysis: FixtureAnalysis,
    halfGoalsAvailable: boolean,
  ): number {
    let score = fixtureAnalysis.dataQuality * 0.6;

    if (fixtureAnalysis.headToHead) {
      score += 8;
    }

    if (fixtureAnalysis.odds) {
      score += 7;
    }

    if (halfGoalsAvailable) {
      score += 15;
    }

    return this.clamp(score);
  }

  private calculateSampleQuality(
    fixtureAnalysis: FixtureAnalysis,
    halfGoals: {
      sampleSize: number;
    } | null,
  ): number {
    const homePlayed = fixtureAnalysis.homeTeamStats?.played ?? 0;

    const awayPlayed = fixtureAnalysis.awayTeamStats?.played ?? 0;

    const teamSample = Math.min(
      100,
      ((Math.min(homePlayed, 20) + Math.min(awayPlayed, 20)) / 40) * 100,
    );

    const halfSample = halfGoals
      ? Math.min(100, (halfGoals.sampleSize / 50) * 100)
      : 0;

    if (!halfGoals) {
      return Number(teamSample.toFixed(2));
    }

    return Number((teamSample * 0.75 + halfSample * 0.25).toFixed(2));
  }

  private buildReasonCodes(
    existing: string[],
    halfGoalsAvailable: boolean,
  ): string[] {
    const reasons = [...existing];

    if (halfGoalsAvailable) {
      reasons.push('HALF_GOAL_HISTORY_AVAILABLE');
    } else {
      reasons.push('HALF_GOAL_HISTORY_INSUFFICIENT');
    }

    return [...new Set(reasons)];
  }

  private clamp(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(100, Math.max(0, value));
  }
}
