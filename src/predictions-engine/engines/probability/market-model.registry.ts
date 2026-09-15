import { Injectable } from '@nestjs/common';

import { PredictionMarket } from '../../enums/prediction-market.enum';
import { MarketModel } from '../../interfaces/market-model.interface';

import { ResultMarketEngine } from './result-market.engine';
import { BttsMarketEngine } from './btts-market.engine';
import { GoalMarketEngine } from './goal-market.engine';
import { CleanSheetMarketEngine } from './clean-sheet-market.engine';
import { HalfMarketEngine } from './half-market.engine';
import { HandicapMarketEngine } from './handicap-market.engine';
import { FirstToScoreMarketEngine } from './first-to-score-market.engine';

@Injectable()
export class MarketModelRegistry {
  private readonly models: MarketModel[];

  constructor(
    private readonly resultMarketEngine: ResultMarketEngine,
    private readonly bttsMarketEngine: BttsMarketEngine,
    private readonly goalMarketEngine: GoalMarketEngine,
    private readonly cleanSheetMarketEngine: CleanSheetMarketEngine,
    private readonly halfMarketEngine: HalfMarketEngine,
    private readonly handicapMarketEngine: HandicapMarketEngine,
    private readonly firstToScoreMarketEngine: FirstToScoreMarketEngine,
  ) {
    this.models = [
      this.resultMarketEngine,
      this.bttsMarketEngine,
      this.goalMarketEngine,
      this.cleanSheetMarketEngine,
      this.halfMarketEngine,
      this.handicapMarketEngine,
      this.firstToScoreMarketEngine,
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
      return Boolean(model.supports(market));
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
