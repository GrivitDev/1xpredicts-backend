// src/ai/league-intelligence/ai-league-intelligence.scheduler.ts

import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { AiLeagueIntelligenceService } from './ai-league-intelligence.service';

@Injectable()
export class AiLeagueIntelligenceScheduler {
  private readonly logger = new Logger(AiLeagueIntelligenceScheduler.name);

  private running = false;

  // ==========================================================
  // NIGHTLY RESEARCH WINDOW
  // 02:00 - 05:00
  // Every 5 minutes
  // ==========================================================

  @Cron('*/5 2-5 * * *', {
    timeZone: 'Africa/Lagos',
  })
  async researchLeagues(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      const leagues =
        await this.aiLeagueIntelligenceService.getAvailableLeagues();

      if (!leagues.length) {
        this.logger.log('No leagues available for AI research.');
        return;
      }

      const league =
        await this.aiLeagueIntelligenceService.findNextLeagueToResearch(
          leagues,
        );

      if (!league) {
        this.logger.log(
          'All available leagues already have fresh intelligence.',
        );
        return;
      }

      await this.aiLeagueIntelligenceService.researchLeague(league);

      this.logger.log(`League intelligence updated: ${league.code}`);
    } catch (error) {
      this.logger.error(
        'League intelligence scheduler failed.',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  constructor(
    private readonly aiLeagueIntelligenceService: AiLeagueIntelligenceService,
  ) {}
}
