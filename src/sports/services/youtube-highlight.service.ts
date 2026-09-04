import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { YoutubeService } from '../providers/youtube.service';

import {
  YoutubeHighlight,
  YoutubeHighlightDocument,
} from '../schemas/youtube-highlight.schema';

import { YoutubeHighlightStatus } from '../interfaces/youtube-highlight.interface';

@Injectable()
export class YoutubeHighlightService {
  private readonly logger = new Logger(YoutubeHighlightService.name);

  private readonly maxRetryCount = 3;

  private readonly retryDelayMinutes = 20;

  constructor(
    private readonly youtubeService: YoutubeService,

    @InjectModel(YoutubeHighlight.name)
    private readonly highlightModel: Model<YoutubeHighlightDocument>,
  ) {}

  // ============================================================
  // QUEUE MATCH
  // ============================================================

  async queueHighlight(data: {
    fixtureId: string;
    competitionId?: string;
    homeTeam: string;
    awayTeam: string;
  }): Promise<YoutubeHighlightDocument> {
    const existing = await this.highlightModel
      .findOne({
        fixtureId: data.fixtureId,
      })
      .exec();

    if (existing) {
      return existing;
    }

    return this.highlightModel.create({
      fixtureId: data.fixtureId,

      competitionId: data.competitionId,

      homeTeam: data.homeTeam,

      awayTeam: data.awayTeam,

      status: YoutubeHighlightStatus.PENDING,

      retryCount: 0,
    });
  }

  // ============================================================
  // PROCESS NEXT
  // ============================================================

  async processNext(): Promise<boolean> {
    const job = await this.highlightModel
      .findOneAndUpdate(
        {
          status: {
            $in: [YoutubeHighlightStatus.PENDING, YoutubeHighlightStatus.RETRY],
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

            error: undefined,
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
      return false;
    }

    try {
      const result = await this.youtubeService.findHighlight(
        job.homeTeam,
        job.awayTeam,
      );

      if (!result) {
        await this.handleNotFound(job);

        return true;
      }

      await this.highlightModel
        .updateOne(
          {
            _id: job._id,
          },
          {
            $set: {
              status: YoutubeHighlightStatus.FOUND,

              videoId: result.videoId,

              videoUrl: result.videoUrl,

              title: result.title,

              channelId: result.channelId,

              channelTitle: result.channelTitle,

              publishedAt: result.publishedAt
                ? new Date(result.publishedAt)
                : undefined,

              thumbnailUrl: result.thumbnailUrl,

              searchedAt: new Date(),

              nextRetryAt: undefined,

              error: undefined,
            },
          },
        )
        .exec();

      return true;
    } catch (error) {
      await this.handleError(job, error);

      return true;
    }
  }

  // ============================================================
  // NOT FOUND
  // ============================================================

  private async handleNotFound(job: YoutubeHighlightDocument): Promise<void> {
    const nextRetryCount = job.retryCount + 1;

    if (nextRetryCount >= this.maxRetryCount) {
      await this.highlightModel
        .updateOne(
          {
            _id: job._id,
          },
          {
            $set: {
              status: YoutubeHighlightStatus.NOT_FOUND,

              retryCount: nextRetryCount,

              searchedAt: new Date(),

              nextRetryAt: undefined,
            },
          },
        )
        .exec();

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

            retryCount: nextRetryCount,

            searchedAt: new Date(),

            nextRetryAt: new Date(
              Date.now() + this.retryDelayMinutes * 60 * 1000,
            ),
          },
        },
      )
      .exec();
  }

  // ============================================================
  // ERROR
  // ============================================================

  private async handleError(
    job: YoutubeHighlightDocument,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);

    const nextRetryCount = job.retryCount + 1;

    if (nextRetryCount >= this.maxRetryCount) {
      await this.highlightModel
        .updateOne(
          {
            _id: job._id,
          },
          {
            $set: {
              status: YoutubeHighlightStatus.SKIPPED,

              retryCount: nextRetryCount,

              searchedAt: new Date(),

              error: message,

              nextRetryAt: undefined,
            },
          },
        )
        .exec();

      this.logger.error(
        `YouTube search permanently skipped for ${job.fixtureId}: ${message}`,
      );

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

            retryCount: nextRetryCount,

            searchedAt: new Date(),

            nextRetryAt: new Date(
              Date.now() + this.retryDelayMinutes * 60 * 1000,
            ),

            error: message,
          },
        },
      )
      .exec();
  }

  // ============================================================
  // READ
  // ============================================================

  async getByFixtureId(
    fixtureId: string,
  ): Promise<YoutubeHighlightDocument | null> {
    return this.highlightModel
      .findOne({
        fixtureId,
      })
      .lean()
      .exec();
  }

  async getFoundByFixtureId(
    fixtureId: string,
  ): Promise<YoutubeHighlightDocument | null> {
    return this.highlightModel
      .findOne({
        fixtureId,
        status: YoutubeHighlightStatus.FOUND,
      })
      .lean()
      .exec();
  }

  async getPendingCount(): Promise<number> {
    return this.highlightModel
      .countDocuments({
        status: {
          $in: [YoutubeHighlightStatus.PENDING, YoutubeHighlightStatus.RETRY],
        },
      })
      .exec();
  }
}
