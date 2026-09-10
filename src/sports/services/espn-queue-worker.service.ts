import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { EspnService } from '../providers/espn.service';
import { TheOddsApiService } from '../providers/the-odds-api.service';

import { SportsProviderRateLimitService } from './sports-provider-rate-limit.service';
import { SportsCollectionService } from './sports-collection.service';
import { EspnQueueService } from './espn-queue.service';
import { EspnQueueBuilderService } from './espn-queue-builder.service';
import { PriorityCompetitionService } from './priority-competition.service';
import { YoutubeHighlightService } from './youtube-highlight.service';

import { EspnQueueJobType } from '../interfaces/espn-queue.interface';

@Injectable()
export class EspnQueueWorkerService implements OnModuleInit {
  private readonly logger = new Logger(EspnQueueWorkerService.name);

  private readonly POLL_INTERVAL_MS = 5000;

  private polling = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly espnService: EspnService,
    private readonly theOddsApiService: TheOddsApiService,
    private readonly sportsProviderRateLimitService: SportsProviderRateLimitService,
    private readonly sportsCollectionService: SportsCollectionService,
    private readonly espnQueueService: EspnQueueService,
    private readonly espnQueueBuilderService: EspnQueueBuilderService,
    private readonly priorityCompetitionService: PriorityCompetitionService,
    private readonly youtubeHighlightService: YoutubeHighlightService,
  ) {}

  onModuleInit(): void {
    this.logger.log('ESPN queue worker initialized');

    this.scheduleNextPoll(0);
  }

  private scheduleNextPoll(delay = this.POLL_INTERVAL_MS): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      void this.poll();
    }, delay);
  }

  private async poll(): Promise<void> {
    if (this.polling) {
      this.scheduleNextPoll();
      return;
    }

    this.polling = true;

    try {
      await this.processNextJob();
    } catch (error) {
      this.logger.error(
        `ESPN queue polling failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.polling = false;
      this.scheduleNextPoll();
    }
  }

  private async processNextJob(): Promise<void> {
    const job = await this.espnQueueService.getNextJob();

    if (!job) {
      return;
    }

    const queueJob = job as unknown as Record<string, unknown>;

    this.logger.debug(
      `Processing ESPN queue job ${String(queueJob.jobKey ?? queueJob._id)} ` +
        `(${String(queueJob.type)})`,
    );

    try {
      await this.processJob(queueJob);

      await this.espnQueueService.markCompleted(String(queueJob._id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `ESPN queue job ${String(queueJob._id)} failed: ${message}`,
      );

      await this.espnQueueService.markFailed(job, message);
    }
  }

  private async processJob(job: Record<string, unknown>): Promise<void> {
    switch (job.type) {
      case EspnQueueJobType.LEAGUE_REFRESH:
        await this.processLeagueRefresh(job);
        return;

      case EspnQueueJobType.UPCOMING_MATCH:
        await this.processUpcomingMatch(job);
        return;

      case EspnQueueJobType.FINISHED_MATCH:
        await this.processFinishedMatch(job);
        return;

      default:
        throw new Error(`Unsupported ESPN queue job type: ${String(job.type)}`);
    }
  }

  // ============================================================
  // LEAGUE REFRESH
  // ============================================================

  private async processLeagueRefresh(
    job: Record<string, unknown>,
  ): Promise<void> {
    if (!job.leagueId) {
      throw new Error('League refresh job has no leagueId');
    }

    await this.sportsCollectionService.processEspnLeagueRefresh({
      leagueId: this.stringifyJobId(job.leagueId),
      season: typeof job['season'] === 'number' ? job['season'] : undefined,
    });

    await this.espnQueueBuilderService.buildLeagueMatchJobs(
      this.stringifyJobId(job.leagueId),
      typeof job['season'] === 'number' ? job['season'] : undefined,
    );
  }

  // ============================================================
  // UPCOMING MATCH
  // ============================================================

  private async processUpcomingMatch(
    job: Record<string, unknown>,
  ): Promise<void> {
    if (!job.leagueId || !job.eventId) {
      throw new Error('Upcoming match job requires leagueId and eventId');
    }

    const leagueId = this.stringifyJobId(job.leagueId);
    const eventId = this.stringifyJobId(job.eventId);

    const event = await this.espnService.getMatch(leagueId, eventId);

    const competitionId = this.extractCompetitionId(event);

    let competition: Record<string, unknown> | null = null;

    if (competitionId) {
      competition = await this.espnService.getCompetition(
        leagueId,
        eventId,
        competitionId,
      );
    }

    await this.sportsCollectionService.collectEspnMatchDetails({
      leagueId,
      event,
      competition,
    });

    const summary = await this.espnService.getMatchSummary(leagueId, eventId);

    await this.sportsCollectionService.collectEspnMatchSummary({
      leagueId,
      eventId,
      summary,
    });

    if (competitionId) {
      const odds = await this.espnService.getMatchOdds(
        leagueId,
        eventId,
        competitionId,
      );

      if (odds.length > 0) {
        await this.sportsCollectionService.collectEspnMatchOdds({
          leagueId,
          eventId,
          competitionId,
          odds,
        });
      }
    }

    await this.processOddsApi(leagueId);

    await this.enqueueFinishedMatch(
      leagueId,
      eventId,
      typeof job['season'] === 'number' ? job['season'] : undefined,
      event,
      typeof job.priority === 'number' ? job.priority : 99,
    );
  }

  // ============================================================
  // FINISHED MATCH
  // ============================================================

  private async processFinishedMatch(
    job: Record<string, unknown>,
  ): Promise<void> {
    if (!job.leagueId || !job.eventId) {
      throw new Error('Finished match job requires leagueId and eventId');
    }

    const leagueId = this.stringifyJobId(job.leagueId);
    const eventId = this.stringifyJobId(job.eventId);

    const event = await this.espnService.getMatch(leagueId, eventId);

    const competitionId = this.extractCompetitionId(event);

    let competition: Record<string, unknown> | null = null;

    if (competitionId) {
      competition = await this.espnService.getCompetition(
        leagueId,
        eventId,
        competitionId,
      );
    }

    await this.sportsCollectionService.collectEspnMatchDetails({
      leagueId,
      event,
      competition,
    });

    const summary = await this.espnService.getMatchSummary(leagueId, eventId);

    await this.sportsCollectionService.collectEspnMatchSummary({
      leagueId,
      eventId,
      summary,
    });

    if (competitionId) {
      const events = await this.espnService.getMatchEvents(
        leagueId,
        eventId,
        competitionId,
      );

      await this.sportsCollectionService.collectEspnMatchEvents({
        leagueId,
        eventId,
        competitionId,
        events,
      });

      const competitorIds = this.extractCompetitorIds(competition);

      for (const competitorId of competitorIds) {
        const statistics = await this.espnService.getMatchStatistics(
          leagueId,
          eventId,
          competitionId,
          competitorId,
        );

        await this.sportsCollectionService.collectEspnMatchStatistics({
          leagueId,
          eventId,
          competitionId,
          teamId: competitorId,
          statistics,
        });
      }

      const odds = await this.espnService.getMatchOdds(
        leagueId,
        eventId,
        competitionId,
      );

      if (odds.length > 0) {
        await this.sportsCollectionService.collectEspnMatchOdds({
          leagueId,
          eventId,
          competitionId,
          odds,
        });
      }
    }

    await this.processOddsApi(leagueId);

    await this.processYoutube(eventId, competitionId);
  }

  // ============================================================
  // ODDS API
  // ============================================================

  private async processOddsApi(leagueId: string): Promise<void> {
    const competition = this.priorityCompetitionService.getById(leagueId);

    if (!competition) {
      return;
    }

    const competitionData = competition as unknown as {
      oddsEnabled?: unknown;
      providers?: {
        oddsApiSportKey?: unknown;
      };
    };

    const oddsEnabled = Boolean(competitionData.oddsEnabled);
    const sportKey = competitionData.providers?.oddsApiSportKey;

    if (!oddsEnabled || typeof sportKey !== 'string' || !sportKey) {
      return;
    }

    const remaining =
      (await this.sportsProviderRateLimitService.getRemainingMonthlyRequests(
        'odds-api',
      )) ?? 0;

    if (remaining <= 0) {
      this.logger.warn(
        'The Odds API monthly quota is exhausted. Skipping request.',
      );

      return;
    }

    const odds = await this.theOddsApiService.getOdds(sportKey, 'eu', [
      'h2h',
      'totals',
      'spreads',
    ]);

    if (odds.length > 0) {
      await this.sportsCollectionService.collectOdds(odds);
    }
  }

  private stringifyJobId(value: unknown): string {
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }

    if (value && typeof value === 'object') {
      const objectValue = value as Record<string, unknown>;

      if (typeof objectValue['$oid'] === 'string') {
        return objectValue['$oid'];
      }

      if (typeof objectValue['toHexString'] === 'function') {
        return (objectValue['toHexString'] as () => string)();
      }

      const stringValue = Reflect.get(objectValue, 'toString');

      if (
        typeof stringValue === 'function' &&
        stringValue !== Object.prototype.toString
      ) {
        const result = Reflect.apply(stringValue, value, []) as unknown;

        if (typeof result === 'string') {
          return result;
        }
      }
    }

    throw new Error('Job ID must be a string, number, or identifiable object');
  }

  // ============================================================
  // YOUTUBE
  // ============================================================

  private async processYoutube(
    eventId: string,
    competitionId?: string,
  ): Promise<void> {
    const remaining =
      (await this.sportsProviderRateLimitService.getRemainingDailyRequests(
        'youtube',
      )) ?? 0;

    if (remaining <= 0) {
      this.logger.warn('YouTube daily quota is exhausted. Skipping request.');

      return;
    }

    await this.youtubeHighlightService.queueFixture(eventId, competitionId);
  }

  // ============================================================
  // FINISHED MATCH JOB
  // ============================================================

  private async enqueueFinishedMatch(
    leagueId: string,
    eventId: string,
    season: number | undefined,
    event: Record<string, unknown>,
    priority: number,
  ): Promise<void> {
    const startTime = this.extractEventStartTime(event);

    const scheduledFor = startTime
      ? new Date(startTime.getTime() + 3 * 60 * 60 * 1000)
      : new Date(Date.now() + 3 * 60 * 60 * 1000);

    await this.espnQueueService.addFinishedMatchJob({
      leagueId,
      eventId,
      season: season ?? 0,
      priority,
      scheduledFor,
    });
  }

  // ============================================================
  // COMPETITION ID
  // ============================================================

  private extractCompetitionId(
    event: Record<string, unknown>,
  ): string | undefined {
    const direct = event['competitionId'];

    if (typeof direct === 'string') {
      return direct.trim() || undefined;
    }

    if (typeof direct === 'number') {
      return String(direct);
    }

    const competitions = event['competitions'];

    if (Array.isArray(competitions)) {
      const first: unknown = competitions[0];

      if (first && typeof first === 'object') {
        const value = (first as Record<string, unknown>)['id'];

        if (typeof value === 'string') {
          return value;
        }

        if (typeof value === 'number') {
          return String(value);
        }
      }
    }

    const competition = event['competition'];

    if (competition && typeof competition === 'object') {
      const value = (competition as Record<string, unknown>)['id'];

      if (typeof value === 'string') {
        return value;
      }

      if (typeof value === 'number') {
        return String(value);
      }
    }

    return undefined;
  }

  // ============================================================
  // COMPETITORS
  // ============================================================

  private extractCompetitorIds(
    competition: Record<string, unknown> | null,
  ): string[] {
    if (!competition) {
      return [];
    }

    const competitors = competition['competitors'];

    if (!Array.isArray(competitors)) {
      return [];
    }

    const ids: string[] = [];

    for (const competitor of competitors) {
      if (!competitor || typeof competitor !== 'object') {
        continue;
      }

      const value = (competitor as Record<string, unknown>)['id'];

      if (typeof value === 'string') {
        ids.push(value);
      } else if (typeof value === 'number') {
        ids.push(String(value));
      }
    }

    return ids;
  }

  // ============================================================
  // EVENT START TIME
  // ============================================================

  private extractEventStartTime(
    event?: Record<string, unknown>,
  ): Date | undefined {
    if (!event) {
      return undefined;
    }

    const value = event['date'];

    if (typeof value !== 'string') {
      return undefined;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? undefined : date;
  }
}
