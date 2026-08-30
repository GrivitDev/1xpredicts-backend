import { Injectable } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { Prediction, PredictionDocument } from './schemas/prediction.schema';

@Injectable()
export class PredictionPreviewService {
  private readonly MAX_PREVIEW = 5;

  private readonly MIN_CONFIDENCE = 80;

  private readonly LOOK_AHEAD_DAYS = 30;

  private cachedIds: string[] = [];

  private cacheExpiresAt = 0;

  // Keep the selection for 5 minutes.
  private readonly CACHE_TIME = 5 * 60 * 1000;

  constructor(
    @InjectModel(Prediction.name)
    private readonly predictionModel: Model<PredictionDocument>,
  ) {}

  // ==========================================================
  // PUBLIC PREVIEW
  // ==========================================================

  async getPublicPreview() {
    const now = Date.now();

    if (this.cachedIds.length && now < this.cacheExpiresAt) {
      const predictions = await this.predictionModel.find({
        _id: {
          $in: this.cachedIds,
        },

        deleted: false,
      });

      const order = new Map(this.cachedIds.map((id, index) => [id, index]));

      return predictions.sort(
        (a, b) =>
          (order.get(a._id.toString()) ?? 0) -
          (order.get(b._id.toString()) ?? 0),
      );
    }

    const previews: PredictionDocument[] = [];

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    for (
      let day = 0;
      day < this.LOOK_AHEAD_DAYS && previews.length < this.MAX_PREVIEW;
      day++
    ) {
      const start = new Date(today);

      start.setDate(start.getDate() + day);

      const end = new Date(start);

      end.setDate(end.getDate() + 1);

      const dailyPredictions = await this.predictionModel
        .find({
          deleted: false,

          settled: false,

          status: 'pending',

          accessType: 'free',

          confidence: {
            $gte: this.MIN_CONFIDENCE,
          },

          kickoffTimestamp: {
            $gte: start.getTime(),

            $lt: end.getTime(),
          },
        })
        .sort({
          confidence: -1,

          kickoffTimestamp: 1,
        })
        .limit(this.MAX_PREVIEW - previews.length);

      previews.push(...dailyPredictions);
    }

    const selected = previews.slice(0, this.MAX_PREVIEW);

    this.cachedIds = selected.map((prediction) => prediction._id.toString());

    this.cacheExpiresAt = now + this.CACHE_TIME;

    return selected;
  }

  // ==========================================================
  // PUBLIC PREVIEW IDS
  // ==========================================================

  async getPublicPreviewIds() {
    const predictions = await this.getPublicPreview();

    return predictions.map((prediction) => prediction._id.toString());
  }

  // ==========================================================
  // CHECK
  // ==========================================================

  async isPublicPrediction(predictionId: string) {
    const ids = await this.getPublicPreviewIds();

    return ids.includes(predictionId);
  }
}
