import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import {
  FootballDataMatch,
  FootballDataMatchDocument,
} from '../schemas/football-data/football-data-match.schema';

import {
  ApiFootballFixture,
  ApiFootballFixtureDocument,
} from '../schemas/api-football/api-football-fixture.schema';

import {
  YouTubeHighlight,
  YouTubeHighlightDocument,
} from '../schemas/youtube-highlight.schema';

import { YoutubeService } from '../providers/youtube.service';

import { YoutubeHighlightStatus } from '../interfaces/youtube-highlight.interface';

import { SPORTS_DATA_COLLECTION_CONFIG } from '../config/sports-data-collection.config';

interface MatchInfo {
  fixtureId: string;
  competitionId?: string;
  homeTeamId?: number;
  awayTeamId?: number;
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

    @InjectModel(ApiFootballFixture.name)
    private readonly apiFootballFixtureModel: Model<ApiFootballFixtureDocument>,

    @InjectModel(FootballDataMatch.name)
    private readonly footballDataMatchModel: Model<FootballDataMatchDocument>,

    @InjectModel(YouTubeHighlight.name)
    private readonly highlightModel: Model<YouTubeHighlightDocument>,
  ) {}

  async queueFixture(
    fixtureId: number,
    competitionId?: string,
  ): Promise<YouTubeHighlightDocument | null> {
    const existing = await this.highlightModel
      .findOne({
        fixtureId: String(fixtureId),
      })
      .exec();

    if (
      existing &&
      (existing.status === YoutubeHighlightStatus.FOUND ||
        existing.status === YoutubeHighlightStatus.SEARCHING)
    ) {
      return existing;
    }

    const match = await this.getMatchInfo(String(fixtureId));

    if (!match) {
      return null;
    }

    return this.highlightModel
      .findOneAndUpdate(
        {
          fixtureId: String(fixtureId),
        },
        {
          $setOnInsert: {
            fixtureId: String(fixtureId),
            competitionId: competitionId ?? match.competitionId,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
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

  async processPending(limit = 1): Promise<number> {
    let processed = 0;

    for (let index = 0; index < limit; index += 1) {
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
                  $lte: new Date(),
                },
              },
            ],
          },
          {
            $set: {
              status: YoutubeHighlightStatus.SEARCHING,
              searchedAt: new Date(),
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
        const match = await this.getMatchInfo(job.fixtureId);

        if (!match) {
          await this.markFailed(job, 'Match data not found');

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

        await this.highlightModel.updateOne(
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
        );

        processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        await this.scheduleRetry(job, message);
      }
    }

    return processed;
  }

  async getRemainingDailyQuota(): Promise<number> {
    return (await this.getDailyUsedRequests()) >= this.config.dailyRequestLimit
      ? 0
      : this.config.dailyRequestLimit - (await this.getDailyUsedRequests());
  }

  private async getDailyUsedRequests(): Promise<number> {
    const start = this.getStartOfWATDay();

    return this.highlightModel.countDocuments({
      searchedAt: {
        $gte: start,
      },
    });
  }

  private async getMatchInfo(fixtureId: string): Promise<MatchInfo | null> {
    const numericFixtureId = Number(fixtureId);

    if (Number.isInteger(numericFixtureId)) {
      const fixture = await this.apiFootballFixtureModel
        .findOne({
          fixtureId: numericFixtureId,
        })
        .lean()
        .exec();

      if (fixture) {
        const payload = fixture.payload as any;

        const home = payload?.teams?.home;
        const away = payload?.teams?.away;

        const dateValue = payload?.fixture?.date ?? fixture.fixtureDate;

        if (home?.name && away?.name && dateValue) {
          return {
            fixtureId: String(numericFixtureId),
            competitionId:
              fixture.leagueId !== undefined
                ? String(fixture.leagueId)
                : undefined,
            homeTeamId: typeof home.id === 'number' ? home.id : undefined,
            awayTeamId: typeof away.id === 'number' ? away.id : undefined,
            homeTeam: home.name,
            awayTeam: away.name,
            date: new Date(dateValue),
          };
        }
      }
    }

    if (!Number.isInteger(numericFixtureId)) {
      return null;
    }

    const footballDataMatch = await this.footballDataMatchModel
      .findOne({
        matchId: numericFixtureId,
      })
      .lean()
      .exec();

    if (!footballDataMatch) {
      return null;
    }

    const payload = footballDataMatch.payload as any;

    const homeTeam =
      payload?.homeTeam?.name ?? `Team ${footballDataMatch.homeTeamId}`;

    const awayTeam =
      payload?.awayTeam?.name ?? `Team ${footballDataMatch.awayTeamId}`;

    return {
      fixtureId: String(footballDataMatch.matchId),
      competitionId: footballDataMatch.competitionCode,
      homeTeamId: footballDataMatch.homeTeamId || undefined,
      awayTeamId: footballDataMatch.awayTeamId || undefined,
      homeTeam,
      awayTeam,
      date: new Date(footballDataMatch.utcDate),
    };
  }

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

    await this.highlightModel.updateOne(
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
    );
  }

  private async markFailed(
    job: YouTubeHighlightDocument,
    reason: string,
  ): Promise<void> {
    await this.highlightModel.updateOne(
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
    );
  }

  private getStartOfWATDay(): Date {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(now);

    const year = Number(parts.find((part) => part.type === 'year')?.value);

    const month = Number(parts.find((part) => part.type === 'month')?.value);

    const day = Number(parts.find((part) => part.type === 'day')?.value);

    const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    start.setUTCHours(start.getUTCHours() - 1);

    return start;
  }
}
