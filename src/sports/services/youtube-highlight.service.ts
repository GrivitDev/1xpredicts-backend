import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  EspnFixture,
  EspnFixtureDocument,
} from '../schemas/espn/espn-fixture.schema';

import {
  YouTubeHighlight,
  YouTubeHighlightDocument,
} from '../schemas/youtube-highlight.schema';

import { YoutubeService } from '../providers/youtube.service';

import { YoutubeHighlightStatus } from '../interfaces/youtube-highlight.interface';

import { SPORTS_DATA_COLLECTION_CONFIG } from '../config/sports-data-collection.config';

import { SportsProviderRateLimitService } from './sports-provider-rate-limit.service';

interface MatchInfo {
  fixtureId: string;
  competitionId?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeam: string;
  awayTeam: string;
  date: Date;
}

@Injectable()
export class YoutubeHighlightService {
  private readonly logger = new Logger(YoutubeHighlightService.name);

  private readonly config = SPORTS_DATA_COLLECTION_CONFIG.YOUTUBE;

  constructor(
    private readonly youtubeService: YoutubeService,

    private readonly sportsProviderRateLimitService: SportsProviderRateLimitService,

    @InjectModel(EspnFixture.name)
    private readonly espnFixtureModel: Model<EspnFixtureDocument>,

    @InjectModel(YouTubeHighlight.name)
    private readonly highlightModel: Model<YouTubeHighlightDocument>,
  ) {}

  // ============================================================
  // QUEUE FIXTURE
  // ============================================================

  async queueFixture(
    fixtureId: string,
    competitionId?: string,
  ): Promise<YouTubeHighlightDocument | null> {
    const normalizedFixtureId = fixtureId.trim();

    if (!normalizedFixtureId) {
      return null;
    }

    const existing = await this.highlightModel
      .findOne({
        fixtureId: normalizedFixtureId,
      })
      .exec();

    if (
      existing &&
      (existing.status === YoutubeHighlightStatus.FOUND ||
        existing.status === YoutubeHighlightStatus.SEARCHING)
    ) {
      return existing;
    }

    const match = await this.getMatchInfo(normalizedFixtureId);

    if (!match) {
      this.logger.warn(
        `Unable to queue YouTube highlight: ESPN fixture ${normalizedFixtureId} was not found`,
      );

      return null;
    }

    return this.highlightModel
      .findOneAndUpdate(
        {
          fixtureId: normalizedFixtureId,
        },
        {
          $set: {
            competitionId: competitionId ?? match.competitionId,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
          },
          $setOnInsert: {
            fixtureId: normalizedFixtureId,
            status: YoutubeHighlightStatus.PENDING,
            retryCount: 0,
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
        },
      )
      .exec();
  }

  // ============================================================
  // PROCESS PENDING
  // ============================================================

  async processPending(limit = 1): Promise<number> {
    let processed = 0;

    for (let index = 0; index < limit; index += 1) {
      const now = new Date();

      const job = await this.highlightModel
        .findOneAndUpdate(
          {
            status: {
              $in: [
                YoutubeHighlightStatus.PENDING,
                YoutubeHighlightStatus.RETRY,
              ],
            },

            $or: [
              {
                nextRetryAt: {
                  $exists: false,
                },
              },
              {
                nextRetryAt: {
                  $lte: now,
                },
              },
            ],
          },
          {
            $set: {
              status: YoutubeHighlightStatus.SEARCHING,
              searchedAt: now,
            },

            $inc: {
              retryCount: 1,
            },
          },
          {
            sort: {
              createdAt: 1,
            },

            returnDocument: 'after',
          },
        )
        .exec();

      if (!job) {
        break;
      }

      try {
        const remaining =
          (await this.sportsProviderRateLimitService.getRemainingDailyRequests(
            'youtube',
          )) ?? 0;

        if (remaining <= 0) {
          await this.highlightModel
            .updateOne(
              {
                _id: job._id,
              },
              {
                $set: {
                  status: YoutubeHighlightStatus.RETRY,
                  nextRetryAt: this.getNextRetryDate(),
                  error: 'YouTube daily provider quota exhausted',
                },
              },
            )
            .exec();

          break;
        }

        const match = await this.getMatchInfo(job.fixtureId);

        if (!match) {
          await this.markFailed(job, 'ESPN match data not found');

          continue;
        }

        const result = await this.youtubeService.findHighlight(
          match.homeTeam,
          match.awayTeam,
          match.date,
        );

        if (!result) {
          await this.scheduleRetry(job, 'No suitable highlight found');

          continue;
        }

        await this.highlightModel
          .updateOne(
            {
              _id: job._id,
            },
            {
              $set: {
                competitionId: match.competitionId ?? job.competitionId,

                homeTeam: match.homeTeam,

                awayTeam: match.awayTeam,

                videoId: result.videoId,

                videoUrl: result.videoUrl,

                title: result.title,

                channelId: result.channelId,

                channelTitle: result.channelTitle,

                publishedAt: result.publishedAt
                  ? new Date(result.publishedAt)
                  : undefined,

                thumbnailUrl: result.thumbnailUrl,

                status: YoutubeHighlightStatus.FOUND,

                nextRetryAt: null,

                error: undefined,

                payload: result as unknown as Record<string, unknown>,
              },
            },
          )
          .exec();

        processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        await this.scheduleRetry(job, message);
      }
    }

    return processed;
  }

  // ============================================================
  // REMAINING DAILY QUOTA
  // ============================================================

  async getRemainingDailyQuota(): Promise<number> {
    return (
      (await this.sportsProviderRateLimitService.getRemainingDailyRequests(
        'youtube',
      )) ?? 0
    );
  }

  // ============================================================
  // DAILY USAGE
  // ============================================================

  private async getDailyUsedRequests(): Promise<number> {
    const remaining = await this.getRemainingDailyQuota();

    return Math.max(this.config.dailyRequestLimit - remaining, 0);
  }

  // ============================================================
  // MATCH INFORMATION
  // ============================================================

  private async getMatchInfo(fixtureId: string): Promise<MatchInfo | null> {
    const normalizedFixtureId = fixtureId.trim();

    if (!normalizedFixtureId) {
      return null;
    }

    const fixture = await this.espnFixtureModel
      .findOne({
        eventId: normalizedFixtureId,
      })
      .lean()
      .exec();

    if (!fixture) {
      return null;
    }

    const payload =
      fixture.payload && typeof fixture.payload === 'object'
        ? fixture.payload
        : {};

    const event =
      payload['event'] && typeof payload['event'] === 'object'
        ? (payload['event'] as Record<string, unknown>)
        : payload;

    const competitionsValue = event['competitions'] ?? payload['competitions'];

    const competitions = Array.isArray(competitionsValue)
      ? competitionsValue
      : [];

    const firstCompetition =
      competitions.length > 0 &&
      competitions[0] &&
      typeof competitions[0] === 'object'
        ? (competitions[0] as Record<string, unknown>)
        : undefined;

    const competitionValue = payload['competition'] ?? event['competition'];

    const competition =
      competitionValue && typeof competitionValue === 'object'
        ? (competitionValue as Record<string, unknown>)
        : firstCompetition;

    const competitorsValue = firstCompetition?.['competitors'];

    const competitors = Array.isArray(competitorsValue) ? competitorsValue : [];

    const competitorObjects = competitors.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object',
    );

    const home =
      competitorObjects.find((item) => item['homeAway'] === 'home') ??
      competitorObjects[0];

    const away =
      competitorObjects.find((item) => item['homeAway'] === 'away') ??
      competitorObjects[1];

    const homeTeamValue = home?.['team'];

    const awayTeamValue = away?.['team'];

    const homeTeam =
      homeTeamValue && typeof homeTeamValue === 'object'
        ? (homeTeamValue as Record<string, unknown>)
        : undefined;

    const awayTeam =
      awayTeamValue && typeof awayTeamValue === 'object'
        ? (awayTeamValue as Record<string, unknown>)
        : undefined;

    const homeName = this.getTeamName(homeTeam);

    const awayName = this.getTeamName(awayTeam);

    const dateValue =
      event['date'] ?? firstCompetition?.['date'] ?? fixture.fixtureDate;

    if (!homeName || !awayName || !dateValue) {
      return null;
    }

    const date =
      dateValue instanceof Date
        ? dateValue
        : typeof dateValue === 'string' || typeof dateValue === 'number'
          ? new Date(dateValue)
          : new Date(Number.NaN);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const competitionId =
      this.getStringValue(competition?.['id']) ??
      this.getStringValue(competition?.['uid']);

    const homeTeamId =
      this.getStringValue(homeTeam?.['id']) ??
      this.getStringValue(fixture.homeTeamId);

    const awayTeamId =
      this.getStringValue(awayTeam?.['id']) ??
      this.getStringValue(fixture.awayTeamId);

    return {
      fixtureId: normalizedFixtureId,
      competitionId,
      homeTeamId,
      awayTeamId,
      homeTeam: homeName,
      awayTeam: awayName,
      date,
    };
  }

  // ============================================================
  // RETRY
  // ============================================================

  private async scheduleRetry(
    job: YouTubeHighlightDocument,
    reason: string,
  ): Promise<void> {
    const maxAttempts = this.config.queue.maxAttempts;

    const retryDelayMinutes = this.config.queue.retryDelayMinutes;

    if (job.retryCount >= maxAttempts) {
      await this.markFailed(job, reason);

      return;
    }

    await this.highlightModel
      .updateOne(
        {
          _id: job._id,
        },
        {
          $set: {
            status: YoutubeHighlightStatus.RETRY,

            nextRetryAt: new Date(Date.now() + retryDelayMinutes * 60_000),

            error: reason,
          },
        },
      )
      .exec();
  }

  // ============================================================
  // FAILED
  // ============================================================

  private async markFailed(
    job: YouTubeHighlightDocument,
    reason: string,
  ): Promise<void> {
    await this.highlightModel
      .updateOne(
        {
          _id: job._id,
        },
        {
          $set: {
            status: YoutubeHighlightStatus.FAILED,

            error: reason,

            nextRetryAt: null,
          },
        },
      )
      .exec();
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private getTeamName(team?: Record<string, unknown>): string | undefined {
    if (!team) {
      return undefined;
    }

    const displayName = team['displayName'];

    if (typeof displayName === 'string' && displayName.trim()) {
      return displayName.trim();
    }

    const name = team['name'];

    if (typeof name === 'string' && name.trim()) {
      return name.trim();
    }

    const shortDisplayName = team['shortDisplayName'];

    if (typeof shortDisplayName === 'string' && shortDisplayName.trim()) {
      return shortDisplayName.trim();
    }

    return undefined;
  }

  private getStringValue(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return undefined;
  }

  private getNextRetryDate(): Date {
    const retryDelayMinutes = this.config.queue.retryDelayMinutes;

    return new Date(Date.now() + retryDelayMinutes * 60_000);
  }
}
