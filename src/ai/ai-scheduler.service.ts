import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { FootballDataService } from '../sports/football-data.service';

import { PredictionsService } from '../predictions/predictions.service';

import { AiPredictionDataService } from './predictions/ai-prediction-data.service';

import { AiPredictionService } from './predictions/ai-prediction.service';

import { AiPredictionAccessType } from './predictions/ai-prediction.interfaces';

import { Match } from '../sports/interfaces/match.interface';

@Injectable()
export class AiSchedulerService {
  private readonly logger = new Logger(AiSchedulerService.name);

  private leagueIndex = 0;

  private running = false;

  // ==========================================================
  // EVERY 5 MINUTES
  // ==========================================================

  @Cron('*/5 * * * *')
  async processPredictions(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.processOneMatch();
    } catch (error) {
      this.logger.error(
        'AI prediction scheduler failed.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  // ==========================================================
  // ONE MATCH
  // ==========================================================

  private async processOneMatch(): Promise<void> {
    const leagues = await this.footballDataService.getLeagues();

    if (!leagues.length) {
      return;
    }

    if (this.leagueIndex >= leagues.length) {
      this.leagueIndex = 0;
    }

    for (let offset = 0; offset < leagues.length; offset++) {
      const index = (this.leagueIndex + offset) % leagues.length;

      const league = leagues[index];

      const matches = await this.getEligibleMatches(league.code);

      if (!matches.length) {
        continue;
      }

      const matchIds = matches.map((match) => match.id);

      const existingMatchIds =
        await this.predictionsService.findExistingMatchIds(matchIds);

      const existing = new Set(existingMatchIds);

      const match = matches.find((item) => !existing.has(item.id));

      if (!match) {
        continue;
      }

      this.leagueIndex = index;

      await this.predictMatch(match, matches);

      return;
    }

    this.leagueIndex = (this.leagueIndex + 1) % leagues.length;
  }

  // ==========================================================
  // 7-DAY WINDOW
  // ==========================================================

  private async getEligibleMatches(leagueCode: string): Promise<Match[]> {
    const matches =
      await this.footballDataService.getFixturesByLeague(leagueCode);

    const now = Date.now();

    const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;

    return matches
      .filter((match) => {
        if (!Number.isFinite(match.kickoffTimestamp)) {
          return false;
        }

        if (match.kickoffTimestamp <= now) {
          return false;
        }

        if (match.kickoffTimestamp > sevenDaysFromNow) {
          return false;
        }

        if (
          ['IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'CANCELLED'].includes(
            match.status || '',
          )
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => a.kickoffTimestamp - b.kickoffTimestamp);
  }

  // ==========================================================
  // PREDICT
  // ==========================================================

  private async predictMatch(
    match: Match,
    eligibleMatches: Match[],
  ): Promise<void> {
    this.logger.log(
      `Generating AI prediction: ${match.homeTeam} vs ${match.awayTeam}`,
    );

    const input = await this.aiPredictionDataService.buildMatchInput(match.id);

    const result = await this.aiPredictionService.generatePrediction({
      match: input,

      useGoogleSearch: true,

      includeReasoning: true,
    });

    const accessCounts = await this.predictionsService.countAccessTypes(
      eligibleMatches.map((item) => item.id),
    );

    const accessTargets = this.calculateAccessTargets(eligibleMatches.length);

    const accessType = this.selectAccessType(
      result.accessType,
      accessCounts,
      accessTargets,
    );

    await this.predictionsService.create({
      matchId: match.id,

      leagueCode: match.leagueCode,

      league: match.league
        ? {
            code: match.league.code,

            name: match.league.name,

            country: match.league.country,

            emblem: match.league.emblem,
          }
        : undefined,

      homeTeam: match.homeTeam,

      awayTeam: match.awayTeam,

      homeTeamBadge: match.homeTeamBadge,

      awayTeamBadge: match.awayTeamBadge,

      probabilities: result.probabilities,

      confidence: result.confidence,

      markets: result.markets.map((market) => ({
        market: market.market,

        selection: market.selection,

        ...(market.playerId
          ? {
              playerId: market.playerId,
            }
          : {}),

        ...(market.playerName
          ? {
              playerName: market.playerName,
            }
          : {}),
      })),

      accessType,

      matchDate: match.date,
    });

    this.logger.log(`AI prediction saved: ${match.id}`);
  }

  // ==========================================================
  // TARGETS
  // ==========================================================

  private calculateAccessTargets(totalMatches: number) {
    if (totalMatches <= 0) {
      return {
        free: 0,
        regular: 0,
        vip: 0,
      };
    }

    if (totalMatches === 1) {
      return {
        free: 1,
        regular: 0,
        vip: 0,
      };
    }

    if (totalMatches === 2) {
      return {
        free: 1,
        regular: 1,
        vip: 0,
      };
    }

    if (totalMatches === 3) {
      return {
        free: 1,
        regular: 1,
        vip: 1,
      };
    }

    const free = Math.round(totalMatches * 0.35);

    const vip = Math.round(totalMatches * 0.15);

    return {
      free,

      regular: totalMatches - free - vip,

      vip,
    };
  }

  // ==========================================================
  // FINAL ACCESS TYPE
  // ==========================================================

  private selectAccessType(
    aiRecommendation: AiPredictionAccessType,
    counts: {
      free: number;
      regular: number;
      vip: number;
    },
    targets: {
      free: number;
      regular: number;
      vip: number;
    },
  ): AiPredictionAccessType {
    const remaining = {
      free: Math.max(targets.free - counts.free, 0),

      regular: Math.max(targets.regular - counts.regular, 0),

      vip: Math.max(targets.vip - counts.vip, 0),
    };

    if (remaining[aiRecommendation] > 0) {
      return aiRecommendation;
    }

    const fallback: {
      type: AiPredictionAccessType;
      remaining: number;
    }[] = [
      {
        type: 'free',
        remaining: remaining.free,
      },

      {
        type: 'regular',
        remaining: remaining.regular,
      },

      {
        type: 'vip',
        remaining: remaining.vip,
      },
    ];

    fallback.sort((a, b) => b.remaining - a.remaining);

    return fallback[0]?.type || 'free';
  }

  constructor(
    private readonly footballDataService: FootballDataService,

    private readonly predictionsService: PredictionsService,

    private readonly aiPredictionDataService: AiPredictionDataService,

    private readonly aiPredictionService: AiPredictionService,
  ) {}
}
