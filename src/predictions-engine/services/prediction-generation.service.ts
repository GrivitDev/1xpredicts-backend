// src/predictions-engine/services/prediction-generation.service.ts

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { PredictionEngineResult } from '../interfaces/prediction-engine-result.interface';
import { PredictionSourceRun } from '../interfaces/prediction-source-run.interface';
import { PredictionSignal } from '../interfaces/prediction-signal.interface';
import { FinalPrediction } from '../interfaces/final-prediction.interface';
import { FinalMarketDecision } from '../interfaces/final-decision-result.interface';

import { PredictionSourceOrchestratorService } from './prediction-source-orchestrator.service';
import { FinalDecisionService } from './final-decision.service';
import { PredictionSaveService } from './prediction-save.service';
import { FixtureAnalysisService } from './fixture-analysis.service';

import { PredictionStatus } from '../enums/prediction-status.enum';

@Injectable()
export class PredictionGenerationService {
  private readonly logger = new Logger(PredictionGenerationService.name);

  constructor(
    private readonly fixtureAnalysisService: FixtureAnalysisService,
    private readonly sourceOrchestrator: PredictionSourceOrchestratorService,
    private readonly finalDecisionService: FinalDecisionService,
    private readonly predictionSaveService: PredictionSaveService,
  ) {}

  async generate(
    fixtureId: string | number,
    options?: {
      forceRefresh?: boolean;
    },
  ): Promise<PredictionEngineResult> {
    const startedAt = Date.now();

    const normalizedFixtureId = this.normalizeFixtureId(fixtureId);

    const existing = await this.predictionSaveService.findByFixture(
      String(normalizedFixtureId),
    );

    if (existing && !options?.forceRefresh) {
      const existingPrediction =
        existing.toObject() as unknown as FinalPrediction;

      return {
        prediction: existingPrediction,
        sourceRuns: [],
        generatedAt:
          this.getDocumentDate(existing, 'updatedAt') ??
          this.getDocumentDate(existing, 'createdAt') ??
          new Date(),
        processingTimeMs: Date.now() - startedAt,
      };
    }

    const analysis = await this.fixtureAnalysisService.analyzeFixture(
      String(normalizedFixtureId),
    );

    if (!analysis) {
      throw new BadRequestException(
        `Unable to build fixture analysis for fixture ${normalizedFixtureId}`,
      );
    }

    const sourceRun = await this.sourceOrchestrator.run(analysis);

    const signals = this.extractSignals(sourceRun);

    const finalDecisions = this.finalDecisionService.decide(signals);

    const completedSources = signals.filter(
      (signal) =>
        signal.status === PredictionStatus.COMPLETED ||
        signal.status === PredictionStatus.PARTIAL,
    ).length;

    const availableSources = signals.filter(
      (signal) =>
        signal.status !== PredictionStatus.FAILED &&
        signal.status !== PredictionStatus.SKIPPED,
    ).length;

    const status =
      completedSources === signals.length
        ? PredictionStatus.COMPLETED
        : completedSources > 0
          ? PredictionStatus.PARTIAL
          : PredictionStatus.FAILED;

    const prediction: FinalPrediction = {
      fixtureId: analysis.fixture.fixtureId,

      competitionId: analysis.fixture.competitionId,

      leagueId: analysis.fixture.leagueId,

      season: analysis.fixture.season,

      kickoff: analysis.fixture.kickoff,

      homeTeam: {
        id: analysis.fixture.homeTeam.teamId,
        name: analysis.fixture.homeTeam.teamName,
      },

      awayTeam: {
        id: analysis.fixture.awayTeam.teamId,
        name: analysis.fixture.awayTeam.teamName,
      },

      status,

      matchProbability: this.buildMatchProbability(signals),

      markets: this.buildMarkets(finalDecisions),

      sourceSignals: signals,

      metadata: {
        engineVersion: '1.0.0',
        calibrationVersion: '1.0.0',
        generatedAt: new Date(),
        completedSources,
        availableSources,
        sourceAgreement: this.calculateSourceAgreement(signals),
        dataQuality: analysis.dataQuality,
      },
    };

    const saved = await this.predictionSaveService.save(prediction);

    return {
      prediction: saved.toObject() as unknown as FinalPrediction,

      sourceRuns: [sourceRun],

      generatedAt: new Date(),

      processingTimeMs: Date.now() - startedAt,
    };
  }

  private extractSignals(sourceRun: PredictionSourceRun): PredictionSignal[] {
    return [sourceRun.statistical, sourceRun.grok, sourceRun.gemini].filter(
      (signal): signal is PredictionSignal => Boolean(signal),
    );
  }

  private buildMarkets(
    decisions: FinalMarketDecision[],
  ): FinalPrediction['markets'] {
    return decisions.map((decision) => ({
      market: decision.market as FinalPrediction['markets'][number]['market'],
      selections: decision.candidates,
      recommendations: {
        low: decision.low,
        medium: decision.medium,
        high: decision.high,
      },
      status: decision.status,
    }));
  }

  private buildMatchProbability(
    signals: PredictionSignal[],
  ): FinalPrediction['matchProbability'] {
    const available = signals.filter(
      (signal) =>
        signal.status === PredictionStatus.COMPLETED ||
        signal.status === PredictionStatus.PARTIAL,
    );

    if (available.length === 0) {
      return {
        home: 0,
        draw: 0,
        away: 0,
        confidence: 0,
      };
    }

    const home = this.average(
      available.map((signal) => signal.matchProbability?.home ?? 0),
    );

    const draw = this.average(
      available.map((signal) => signal.matchProbability?.draw ?? 0),
    );

    const away = this.average(
      available.map((signal) => signal.matchProbability?.away ?? 0),
    );

    const confidence = this.average(
      available.map((signal) => this.getSignalConfidence(signal)),
    );

    return {
      home,
      draw,
      away,
      confidence,
    };
  }

  private getSignalConfidence(signal: PredictionSignal): number {
    const candidate = signal.recommendations?.[0];

    if (candidate && typeof candidate.confidence === 'number') {
      return candidate.confidence;
    }

    return 0;
  }

  private calculateSourceAgreement(signals: PredictionSignal[]): number {
    const available = signals.filter(
      (signal) =>
        signal.status === PredictionStatus.COMPLETED ||
        signal.status === PredictionStatus.PARTIAL,
    );

    if (available.length <= 1) {
      return available.length === 1 ? 1 : 0;
    }

    const predictions = available
      .map((signal) => {
        const probabilities = signal.matchProbability;

        if (!probabilities) {
          return null;
        }

        const values = [
          probabilities.home ?? 0,
          probabilities.draw ?? 0,
          probabilities.away ?? 0,
        ];

        return values.indexOf(Math.max(...values));
      })
      .filter((value): value is number => value !== null);

    if (predictions.length <= 1) {
      return 0;
    }

    const counts = new Map<number, number>();

    for (const prediction of predictions) {
      counts.set(prediction, (counts.get(prediction) ?? 0) + 1);
    }

    const highestAgreement = Math.max(...counts.values());

    return highestAgreement / predictions.length;
  }

  private average(values: number[]): number {
    const validValues = values.filter((value) => Number.isFinite(value));

    if (validValues.length === 0) {
      return 0;
    }

    return (
      validValues.reduce((sum, value) => sum + value, 0) / validValues.length
    );
  }

  private normalizeFixtureId(fixtureId: string | number): number {
    const numericFixtureId =
      typeof fixtureId === 'number' ? fixtureId : Number(fixtureId);

    if (!Number.isInteger(numericFixtureId) || numericFixtureId <= 0) {
      throw new BadRequestException('A valid fixtureId is required');
    }

    return numericFixtureId;
  }

  private getDocumentDate(
    document: unknown,
    field: 'updatedAt' | 'createdAt',
  ): Date | null {
    const value = (document as Record<string, unknown>)?.[field];

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);

      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  }
}
