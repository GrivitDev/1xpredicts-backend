// src/predictions-engine/engines/probability/market-model.registry.ts

import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
import { MarketModel } from '../../interfaces/market-model.interface';

import { ResultMarketEngine } from './result-market.engine';
import { BttsMarketEngine } from './btts-market.engine';
import { GoalMarketEngine } from './goal-market.engine';
import { HalfMarketEngine } from './half-market.engine';
import { HandicapMarketEngine } from './handicap-market.engine';

@Injectable()
export class MarketModelRegistry {
  private readonly models: readonly MarketModel[];

  constructor(
    private readonly resultMarketEngine: ResultMarketEngine,
    private readonly bttsMarketEngine: BttsMarketEngine,
    private readonly goalMarketEngine: GoalMarketEngine,
    private readonly halfMarketEngine: HalfMarketEngine,
    private readonly handicapMarketEngine: HandicapMarketEngine,
  ) {
    this.models = [
      this.resultMarketEngine,
      this.bttsMarketEngine,
      this.goalMarketEngine,
      this.halfMarketEngine,
      this.handicapMarketEngine,
    ];
  }

  getModel(market: PredictionMarket): MarketModel | null {
    return this.models.find((model) => this.supports(model, market)) ?? null;
  }

  getModels(market: PredictionMarket): MarketModel[] {
    return this.models.filter((model) => this.supports(model, market));
  }

  supports(model: MarketModel, market: PredictionMarket): boolean {
    if (typeof model.supports === 'function') {
      return model.supports(market);
    }

    if (Array.isArray(model.supportedMarkets)) {
      return model.supportedMarkets.includes(market);
    }

    if (typeof model.market === 'string') {
      return model.market === market;
    }

    return false;
  }
}
