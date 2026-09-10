// src/predictions-engine/services/prediction-save.service.ts

import { Injectable } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { Prediction, PredictionDocument } from '../schemas/prediction.schema';

import { FinalPrediction } from '../interfaces/final-prediction.interface';

@Injectable()
export class PredictionSaveService {
  constructor(
    @InjectModel(Prediction.name)
    private readonly predictionModel: Model<PredictionDocument>,
  ) {}

  async save(prediction: FinalPrediction): Promise<PredictionDocument> {
    const existing = await this.predictionModel
      .findOne({
        fixtureId: prediction.fixtureId,
      })
      .exec();

    if (existing) {
      existing.set(prediction);
      existing.set('updatedAt', new Date());

      return existing.save();
    }

    const created = new this.predictionModel(prediction);
    created.set('updatedAt', new Date());

    return created.save();
  }

  async findByFixture(fixtureId: string): Promise<PredictionDocument | null> {
    return this.predictionModel
      .findOne({
        fixtureId: Number(fixtureId),
      })
      .exec();
  }

  async findById(predictionId: string): Promise<PredictionDocument | null> {
    return this.predictionModel.findById(predictionId).exec();
  }

  async removeByFixture(fixtureId: string): Promise<void> {
    await this.predictionModel
      .deleteOne({
        fixtureId: Number(fixtureId),
      })
      .exec();
  }
}
