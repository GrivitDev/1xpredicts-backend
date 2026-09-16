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
    for (const model of this.models) {
      if (this.supports(model, market)) {
        return model;
      }
    }

    return null;
  }

  getModels(market: PredictionMarket): MarketModel[] {
    const matched: MarketModel[] = [];

    for (const model of this.models) {
      if (this.supports(model, market)) {
        matched.push(model);
      }
    }

    return matched;
  }

  supports(model: MarketModel, market: PredictionMarket): boolean {
    if (typeof model.supports === 'function' && model.supports(market)) {
      return true;
    }

    if (
      Array.isArray(model.supportedMarkets) &&
      model.supportedMarkets.includes(market)
    ) {
      return true;
    }

    if (typeof model.market === 'string' && model.market === market) {
      return true;
    }

    return false;
  }
}
