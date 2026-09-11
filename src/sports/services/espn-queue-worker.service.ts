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
      `Processing ESPN queue job ${String(
        queueJob.jobKey ?? queueJob._id,
      )} (${String(queueJob.type)})`,
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

    const leagueId = this.stringifyJobId(job.leagueId);

    const season = typeof job.season === 'number' ? job.season : undefined;

    await this.sportsCollectionService.processEspnLeagueRefresh({
      leagueId,
      season,
    });

    await this.espnQueueBuilderService.buildLeagueMatchJobs(leagueId, season);
  }

  // ============================================================
  // UPCOMING MATCH
  // ============================================================

  /**
   * Normal upcoming-match pipeline:
   *
   * 1. Refresh event from ESPN.
   * 2. Save the complete event payload.
   * 3. Collect the richer ESPN summary.
   * 4. Collect independent Odds API data.
   * 5. Schedule the finished-match job.
   *
   * No separate:
   * - competition call
   * - leaders call
   * - plays call
   * - statistics call
   * - ESPN odds call
   */
  private async processUpcomingMatch(
    job: Record<string, unknown>,
  ): Promise<void> {
    if (!job.leagueId || !job.eventId) {
      throw new Error('Upcoming match job requires leagueId and eventId');
    }

    const leagueId = this.stringifyJobId(job.leagueId);

    const eventId = this.stringifyJobId(job.eventId);

    const event = await this.espnService.getMatch(leagueId, eventId);

    /*
     * The event already contains its competition,
     * competitors, statistics and details when ESPN provides them.
     */
    await this.sportsCollectionService.collectEspnMatchDetails({
      leagueId,
      event,
    });

    /*
     * Summary is the only additional ESPN match-level
     * enrichment call.
     */
    const summary = await this.espnService.getMatchSummary(leagueId, eventId);

    await this.sportsCollectionService.collectEspnMatchSummary({
      leagueId,
      eventId,
      summary,
    });

    /*
     * The Odds API remains the independent odds source.
     */
    await this.processOddsApi(leagueId);

    await this.enqueueFinishedMatch(
      leagueId,
      eventId,
      typeof job.season === 'number' ? job.season : undefined,
      event,
      typeof job.priority === 'number' ? job.priority : 99,
    );
  }

  // ============================================================
  // FINISHED MATCH
  // ============================================================

  /**
   * Normal finished-match pipeline:
   *
   * 1. Refresh final event from ESPN.
   * 2. Save complete final event payload.
   * 3. Collect summary.
   * 4. Collect independent Odds API data.
   * 5. Queue YouTube processing.
   *
   * We do not make separate:
   * - competition
   * - plays
   * - statistics
   * - ESPN odds
   * requests.
   */
  private async processFinishedMatch(
    job: Record<string, unknown>,
  ): Promise<void> {
    if (!job.leagueId || !job.eventId) {
      throw new Error('Finished match job requires leagueId and eventId');
    }

    const leagueId = this.stringifyJobId(job.leagueId);

    const eventId = this.stringifyJobId(job.eventId);

    const event = await this.espnService.getMatch(leagueId, eventId);

    await this.sportsCollectionService.collectEspnMatchDetails({
      leagueId,
      event,
    });

    const summary = await this.espnService.getMatchSummary(leagueId, eventId);

    await this.sportsCollectionService.collectEspnMatchSummary({
      leagueId,
      eventId,
      summary,
    });

    /*
     * Odds remain sourced independently from The Odds API.
     */
    await this.processOddsApi(leagueId);

    await this.processYoutube(eventId);
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

  // ============================================================
  // YOUTUBE
  // ============================================================

  private async processYoutube(eventId: string): Promise<void> {
    const remaining =
      (await this.sportsProviderRateLimitService.getRemainingDailyRequests(
        'youtube',
      )) ?? 0;

    if (remaining <= 0) {
      this.logger.warn('YouTube daily quota is exhausted. Skipping request.');

      return;
    }

    await this.youtubeHighlightService.queueFixture(eventId);
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
  // EVENT START TIME
  // ============================================================

  private extractEventStartTime(
    event?: Record<string, unknown>,
  ): Date | undefined {
    if (!event) {
      return undefined;
    }

    const value = event.date;

    if (typeof value !== 'string') {
      return undefined;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  // ============================================================
  // JOB ID
  // ============================================================

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
}
