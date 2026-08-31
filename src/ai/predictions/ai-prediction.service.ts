// src/ai/predictions/ai-prediction.service.ts

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { GeminiService } from '../gemini/gemini.service';

import {
  AiPredictionRequest,
  AiPredictionResult,
  AiPredictionMarket,
  AiResearchFinding,
  AiResearchSource,
  AiPredictionMatchInput,
} from './ai-prediction.interfaces';

import {
  AI_PREDICTION_SYSTEM_PROMPT,
  buildMatchPredictionPrompt,
} from './prompts/match-prediction.prompt';

import {
  findPredictionMarket,
  isValidPredictionSelection,
} from '../../predictions/constants/prediction-market-options';

import { PredictionMarket } from '../../predictions/constants/prediction-markets';

@Injectable()
export class AiPredictionService {
  private readonly logger = new Logger(AiPredictionService.name);

  constructor(private readonly geminiService: GeminiService) {}

  // ==========================================================
  // GENERATE
  // ==========================================================

  async generatePrediction(
    request: AiPredictionRequest,
  ): Promise<AiPredictionResult> {
    this.validateRequest(request);

    const prompt = buildMatchPredictionPrompt(
      request.match,
      request.requestedMarkets,
    );

    const result = await this.geminiService.generateJson<AiPredictionResult>({
      task: 'prediction',

      prompt,

      options: {
        maxOutputTokens: 5000,

        systemInstruction: AI_PREDICTION_SYSTEM_PROMPT,
      },
    });

    if (!result.data) {
      throw new BadRequestException('Gemini returned no prediction');
    }

    return this.validatePrediction(result.data, request.match);
  }

  // ==========================================================
  // REQUEST VALIDATION
  // ==========================================================

  private validateRequest(request: AiPredictionRequest): void {
    if (!request?.match) {
      throw new BadRequestException('Match data is required');
    }

    const match = request.match;

    if (!match.matchId) {
      throw new BadRequestException('matchId is required');
    }

    if (!match.homeTeam?.trim()) {
      throw new BadRequestException('Home team is required');
    }

    if (!match.awayTeam?.trim()) {
      throw new BadRequestException('Away team is required');
    }

    if (!match.matchDate) {
      throw new BadRequestException('matchDate is required');
    }
  }

  // ==========================================================
  // RESULT VALIDATION
  // ==========================================================

  private validatePrediction(
    result: AiPredictionResult,
    match: AiPredictionMatchInput,
  ): AiPredictionResult {
    if (result.matchId !== match.matchId) {
      throw new BadRequestException('Gemini returned the wrong matchId');
    }

    if (result.homeTeam?.trim() !== match.homeTeam.trim()) {
      throw new BadRequestException('Gemini returned the wrong home team');
    }

    if (result.awayTeam?.trim() !== match.awayTeam.trim()) {
      throw new BadRequestException('Gemini returned the wrong away team');
    }

    if (!['HOME', 'DRAW', 'AWAY'].includes(result.prediction)) {
      throw new BadRequestException('Invalid AI prediction');
    }

    const home = this.toInteger(result.probabilities?.home);

    const draw = this.toInteger(result.probabilities?.draw);

    const away = this.toInteger(result.probabilities?.away);

    if (home < 0 || draw < 0 || away < 0) {
      throw new BadRequestException(
        'Prediction probabilities cannot be negative',
      );
    }

    if (home + draw + away !== 100) {
      throw new BadRequestException('Prediction probabilities must total 100');
    }

    const confidence = this.toInteger(result.confidence);

    if (confidence < 1 || confidence > 100) {
      throw new BadRequestException(
        'Prediction confidence must be between 1 and 100',
      );
    }

    const markets = this.validateMarkets(result.markets);

    const research = this.validateResearch(result.research);

    const reasoning = this.normalizeStrings(result.reasoning);

    const keyFactors = this.normalizeStrings(result.keyFactors);

    const risks = this.normalizeStrings(result.risks);

    const sources = this.mergeSources(
      this.normalizeSources(result.sources),

      research.flatMap((item) => item.sources),

      markets.flatMap((market) => market.supportingSources),
    );

    const accessType = this.validateAccessType(result.accessType);

    const accessReason =
      typeof result.accessReason === 'string' ? result.accessReason.trim() : '';

    return {
      matchId: match.matchId,

      homeTeam: match.homeTeam,

      awayTeam: match.awayTeam,

      prediction: result.prediction,

      probabilities: {
        home,
        draw,
        away,
      },

      confidence,

      markets,

      accessType,

      accessReason,

      reasoning,

      keyFactors,

      risks,

      recommendation:
        typeof result.recommendation === 'string'
          ? result.recommendation.trim()
          : undefined,

      research,

      sources,
    };
  }

  // ==========================================================
  // ACCESS
  // ==========================================================

  private validateAccessType(accessType: unknown): 'free' | 'regular' | 'vip' {
    if (
      accessType !== 'free' &&
      accessType !== 'regular' &&
      accessType !== 'vip'
    ) {
      throw new BadRequestException('Invalid AI access type');
    }

    return accessType;
  }

  // ==========================================================
  // MARKETS
  // ==========================================================

  private validateMarkets(
    markets?: AiPredictionMarket[],
  ): AiPredictionMarket[] {
    if (!Array.isArray(markets)) {
      return [];
    }

    const playerMarkets = new Set<PredictionMarket>([
      'ANYTIME_GOALSCORER',
      'FIRST_GOALSCORER',
      'PLAYER_SHOTS',
      'PLAYER_SHOTS_ON_TARGET',
      'PLAYER_ASSISTS',
    ]);

    const seen = new Set<string>();

    return markets
      .filter((market) => {
        if (!market) {
          return false;
        }

        if (
          typeof market.market !== 'string' ||
          typeof market.selection !== 'string'
        ) {
          return false;
        }

        if (typeof market.confidence !== 'number') {
          return false;
        }

        if (market.confidence < 60 || market.confidence > 100) {
          return false;
        }

        const config = findPredictionMarket(market.market);

        if (!config) {
          return false;
        }

        if (!isValidPredictionSelection(market.market, market.selection)) {
          return false;
        }

        if (playerMarkets.has(market.market) && !market.playerName?.trim()) {
          return false;
        }

        // One prediction per market.
        if (seen.has(market.market)) {
          return false;
        }

        seen.add(market.market);

        return true;
      })
      .map((market) => ({
        market: market.market,

        selection: market.selection.trim(),

        confidence: this.toInteger(market.confidence),

        reasoning:
          typeof market.reasoning === 'string' ? market.reasoning.trim() : '',

        supportingSources: this.normalizeSources(market.supportingSources),

        playerId: market.playerId?.trim() || undefined,

        playerName: market.playerName?.trim() || undefined,
      }));
  }

  // ==========================================================
  // RESEARCH
  // ==========================================================

  private validateResearch(
    research?: AiResearchFinding[],
  ): AiResearchFinding[] {
    if (!Array.isArray(research)) {
      return [];
    }

    return research
      .filter(
        (item) =>
          item &&
          typeof item.topic === 'string' &&
          typeof item.finding === 'string',
      )
      .map((item) => ({
        topic: item.topic.trim(),

        finding: item.finding.trim(),

        sources: this.normalizeSources(item.sources),
      }))
      .filter((item) => item.topic.length > 0 && item.finding.length > 0);
  }

  // ==========================================================
  // SOURCES
  // ==========================================================

  private normalizeSources(sources?: AiResearchSource[]): AiResearchSource[] {
    if (!Array.isArray(sources)) {
      return [];
    }

    return sources
      .filter(
        (source) =>
          source &&
          typeof source.title === 'string' &&
          typeof source.url === 'string',
      )
      .map((source) => ({
        title: source.title.trim(),

        url: source.url.trim(),
      }))
      .filter(
        (source) => source.title.length > 0 && /^https?:\/\//i.test(source.url),
      );
  }

  // ==========================================================
  // MERGE SOURCES
  // ==========================================================

  private mergeSources(...groups: AiResearchSource[][]): AiResearchSource[] {
    const map = new Map<string, AiResearchSource>();

    for (const group of groups) {
      for (const source of group) {
        if (!map.has(source.url)) {
          map.set(source.url, source);
        }
      }
    }

    return Array.from(map.values());
  }

  // ==========================================================
  // STRINGS
  // ==========================================================

  private normalizeStrings(values?: string[]): string[] {
    if (!Array.isArray(values)) {
      return [];
    }

    return values
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  // ==========================================================
  // INTEGER
  // ==========================================================

  private toInteger(value: unknown): number {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      throw new BadRequestException('Gemini returned an invalid number');
    }

    return Math.round(number);
  }
}
