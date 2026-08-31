// src/ai/ai-scheduler.service.ts

import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { FootballDataService } from '../sports/football-data.service';

import { PredictionsService } from '../predictions/predictions.service';

import { AiPredictionDataService } from './predictions/ai-prediction-data.service';

import { AiPredictionService } from './predictions/ai-prediction.service';

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
  // PROCESS ONE MATCH
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

      const predicted = new Set(existingMatchIds);

      const match = matches.find((item) => !predicted.has(item.id));

      if (!match) {
        continue;
      }

      this.leagueIndex = index;

      await this.predictMatch(match);

      return;
    }

    this.leagueIndex = (this.leagueIndex + 1) % leagues.length;
  }

  // ==========================================================
  // 7-DAY MATCH WINDOW
  // ==========================================================

  private async getEligibleMatches(leagueCode: string): Promise<Match[]> {
    const matches =
      await this.footballDataService.getFixturesByLeague(leagueCode);

    const now = Date.now();

    const sevenDays = now + 7 * 24 * 60 * 60 * 1000;

    return matches
      .filter((match) => {
        if (match.kickoffTimestamp <= now) {
          return false;
        }

        if (match.kickoffTimestamp > sevenDays) {
          return false;
        }

        if (
          match.status === 'IN_PLAY' ||
          match.status === 'PAUSED' ||
          match.status === 'FINISHED' ||
          match.status === 'POSTPONED' ||
          match.status === 'CANCELLED'
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

  private async predictMatch(match: Match): Promise<void> {
    this.logger.log(`AI prediction: ${match.homeTeam} vs ${match.awayTeam}`);

    const input = await this.aiPredictionDataService.buildMatchInput(match.id);

    const result = await this.aiPredictionService.generatePrediction({
      match: input,

      useGoogleSearch: true,

      includeReasoning: true,
    });

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
      })),

      matchDate: match.date,

      accessType: 'free',

      price: 0,
    });

    this.logger.log(`AI prediction saved: ${match.id}`);
  }

  constructor(
    private readonly footballDataService: FootballDataService,

    private readonly predictionsService: PredictionsService,

    private readonly aiPredictionDataService: AiPredictionDataService,

    private readonly aiPredictionService: AiPredictionService,
  ) {}
}
