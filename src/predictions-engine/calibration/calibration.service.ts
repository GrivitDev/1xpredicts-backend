// src/predictions-engine/calibration/calibration.service.ts

import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  PredictionEnginePrediction,
  PredictionEnginePredictionDocument,
} from '../schemas/prediction.schema';

import {
  PredictionCalibration,
  PredictionCalibrationDocument,
} from '../schemas/prediction-calibration.schema';

import { PredictionStatus } from '../enums/prediction-status.enum';
import { PredictionMarket } from '../enums/prediction-market.enum';

import { CalibrationEngine } from './calibration.engine';
import { PREDICTION_ENGINE_CONFIG } from '../config/prediction-engine.config';

@Injectable()
export class CalibrationService {
  private readonly logger = new Logger(CalibrationService.name);

  constructor(
    @InjectModel(PredictionEnginePrediction.name)
    private readonly predictionModel: Model<PredictionEnginePredictionDocument>,

    @InjectModel(PredictionCalibration.name)
    private readonly calibrationModel: Model<PredictionCalibrationDocument>,

    private readonly calibrationEngine: CalibrationEngine,
  ) {}

  async rebuild(
    market: PredictionMarket,
    selection: string,
    modelVersion: string,
  ): Promise<PredictionCalibrationDocument> {
    const predictions = await this.predictionModel
      .find({
        market,
        selection,
        modelVersion,
        status: {
          $in: [PredictionStatus.WON, PredictionStatus.LOST],
        },
      })
      .select({
        probability: 1,
        confidence: 1,
        status: 1,

        /*
         * These fields are the evidence state recorded when the
         * prediction was generated.
         */
        dataQuality: 1,
        modelAgreement: 1,
        safetyScore: 1,
      })
      .lean()
      .exec();

    const sampleSize = predictions.length;

    const wins = predictions.filter(
      (prediction) => prediction.status === PredictionStatus.WON,
    ).length;

    const losses = predictions.filter(
      (prediction) => prediction.status === PredictionStatus.LOST,
    ).length;

    const actualSuccessRate = sampleSize > 0 ? wins / sampleSize : 0;

    const averageProbability =
      sampleSize > 0
        ? predictions.reduce(
            (sum, prediction) => sum + this.clamp(prediction.probability, 0, 1),
            0,
          ) / sampleSize
        : 0;

    const averageConfidence =
      sampleSize > 0
        ? predictions.reduce(
            (sum, prediction) => sum + this.clamp(prediction.confidence, 0, 98),
            0,
          ) / sampleSize
        : 0;

    /*
     * ----------------------------------------------------------
     * EVIDENCE SUPPORT
     * ----------------------------------------------------------
     *
     * This reconstructs how strongly the original prediction was
     * supported by:
     *
     *   - data quality
     *   - model agreement
     *   - safety assessment
     *
     * A failed prediction with strong supporting evidence is not
     * automatically treated as evidence that the model was
     * systematically miscalibrated.
     */
    const evidenceSupports = predictions.map((prediction) =>
      this.calculateEvidenceSupport(prediction),
    );

    const evidenceSupport =
      evidenceSupports.length > 0
        ? evidenceSupports.reduce((sum, value) => sum + value, 0) /
          evidenceSupports.length
        : 0;

    /*
     * ----------------------------------------------------------
     * HIGH-CONFIDENCE CALIBRATION
     * ----------------------------------------------------------
     *
     * Compare observed failure rate with the failure rate implied
     * by the probabilities themselves.
     *
     * Example:
     *
     *   predicted probability = 80%
     *   expected failure rate = 20%
     *
     * One loss does not establish calibration failure.
     */
    const meaningfulConfidenceThreshold =
      this.getMeaningfulConfidenceThreshold();

    const highConfidencePredictions = predictions.filter(
      (prediction) =>
        this.clamp(prediction.confidence, 0, 98) >=
        meaningfulConfidenceThreshold,
    );

    const highConfidenceSampleSize = highConfidencePredictions.length;

    const highConfidenceCalibrationGap = this.calculateFailureCalibrationGap(
      highConfidencePredictions,
    );

    /*
     * ----------------------------------------------------------
     * EVIDENCE-SUPPORTED HIGH-CONFIDENCE CALIBRATION
     * ----------------------------------------------------------
     *
     * This isolates predictions where the recorded evidence
     * package was itself sufficiently strong.
     */
    const evidenceSupportedHighConfidencePredictions =
      highConfidencePredictions.filter(
        (prediction) => this.calculateEvidenceSupport(prediction) >= 0.6,
      );

    const evidenceSupportedHighConfidenceSampleSize =
      evidenceSupportedHighConfidencePredictions.length;

    const evidenceSupportedHighConfidenceCalibrationGap =
      this.calculateFailureCalibrationGap(
        evidenceSupportedHighConfidencePredictions,
      );

    const result = this.calibrationEngine.calculate({
      market,
      selection,
      modelVersion,

      sampleSize,

      averageProbability,

      actualSuccessRate,

      averageConfidence,

      evidenceSupport,

      highConfidenceSampleSize,

      highConfidenceCalibrationGap,

      evidenceSupportedHighConfidenceSampleSize,

      evidenceSupportedHighConfidenceCalibrationGap,
    });

    const saved = await this.calibrationModel
      .findOneAndUpdate(
        {
          market,
          selection,
          modelVersion,
        },
        {
          $set: {
            market,
            selection,
            modelVersion,

            sampleSize,

            wins,

            losses,

            averageProbability: result.averageProbability,

            actualSuccessRate: result.actualSuccessRate,

            calibrationError: result.calibrationError,

            adjustment: result.adjustment,

            reliabilityScore: result.reliabilityScore,

            confidenceReliability: result.confidenceReliability,

            shouldAdjust: result.shouldAdjust,

            calculatedAt: new Date(),
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
          setDefaultsOnInsert: true,
        },
      )
      .exec();

    if (!saved) {
      throw new Error(
        `Unable to persist calibration for ${market}:${selection ?? 'default'}:${modelVersion}`,
      );
    }

    this.logger.debug(
      `Calibration rebuilt: market=${market} selection=${selection ?? 'default'} model=${modelVersion} sample=${sampleSize} accuracy=${actualSuccessRate.toFixed(4)} error=${result.calibrationError.toFixed(4)} evidence=${evidenceSupport.toFixed(4)} highConfidenceGap=${highConfidenceCalibrationGap.toFixed(4)} evidenceSupportedGap=${evidenceSupportedHighConfidenceCalibrationGap.toFixed(4)} adjust=${result.shouldAdjust}`,
    );

    return saved;
  }

  async rebuildEvent(eventId: string): Promise<void> {
    const predictions = await this.predictionModel
      .find({
        eventId,
        status: {
          $in: [PredictionStatus.WON, PredictionStatus.LOST],
        },
      })
      .select({
        market: 1,
        selection: 1,
        modelVersion: 1,
      })
      .lean()
      .exec();

    const groups = new Map<
      string,
      {
        market: PredictionMarket;
        selection: string;
        modelVersion: string;
      }
    >();

    for (const prediction of predictions) {
      const key = [
        prediction.market,
        prediction.selection ?? '',
        prediction.modelVersion,
      ].join('|');

      if (!groups.has(key)) {
        groups.set(key, {
          market: prediction.market,
          selection: prediction.selection,
          modelVersion: prediction.modelVersion,
        });
      }
    }

    for (const group of groups.values()) {
      await this.rebuild(group.market, group.selection, group.modelVersion);
    }
  }

  async getCalibration(
    market: PredictionMarket,
    selection: string,
    modelVersion: string,
  ): Promise<PredictionCalibrationDocument | null> {
    return this.calibrationModel
      .findOne({
        market,
        selection,
        modelVersion,
      })
      .lean()
      .exec();
  }

  private calculateEvidenceSupport(prediction: {
    dataQuality?: unknown;
    modelAgreement?: unknown;
    safetyScore?: unknown;
  }): number {
    const dataQuality = this.readPercentage(prediction.dataQuality);

    const modelAgreement = this.readNormalized(prediction.modelAgreement);

    const safety = this.readPercentage(prediction.safetyScore);

    /*
     * These are already generated evidence assessments, so
     * calibration uses them directly rather than inventing a new
     * prediction model.
     */
    return this.clamp(
      dataQuality * 0.4 + modelAgreement * 0.3 + safety * 0.3,
      0,
      1,
    );
  }

  private calculateFailureCalibrationGap(
    predictions: Array<{
      probability?: number;
      status?: PredictionStatus;
    }>,
  ): number {
    if (!predictions.length) {
      return 0;
    }

    let observedFailures = 0;

    let expectedFailures = 0;

    for (const prediction of predictions) {
      const probability = this.clamp(prediction.probability ?? 0, 0, 1);

      if (prediction.status === PredictionStatus.LOST) {
        observedFailures += 1;
      }

      expectedFailures += 1 - probability;
    }

    const observedFailureRate = observedFailures / predictions.length;

    const expectedFailureRate = expectedFailures / predictions.length;

    /*
     * Positive values mean there were more failures than the
     * probabilities themselves predicted.
     */
    return this.clamp(observedFailureRate - expectedFailureRate, -1, 1);
  }

  private getMeaningfulConfidenceThreshold(): number {
    const threshold =
      PREDICTION_ENGINE_CONFIG.calibration.meaningfulConfidenceThreshold;

    return this.clamp(threshold, 0, 98);
  }

  private readPercentage(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0;
    }

    return this.clamp(value / 100, 0, 1);
  }

  private readNormalized(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0;
    }

    return this.clamp(value, 0, 1);
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) {
      return minimum;
    }

    return Math.min(Math.max(value, minimum), maximum);
  }
}
