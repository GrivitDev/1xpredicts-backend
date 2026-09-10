// src/predictions-engine/services/final-decision.service.ts

import { Injectable } from '@nestjs/common';

import { FinalDecisionEngine } from '../engines/final/final-decision.engine';

import { PredictionSignal } from '../interfaces/prediction-signal.interface';

import { FinalMarketDecision } from '../interfaces/final-decision-result.interface';

@Injectable()
export class FinalDecisionService {
  constructor(private readonly finalDecisionEngine: FinalDecisionEngine) {}

  decide(
    signals: PredictionSignal[],
    calibrationBySelection: Map<string, number> = new Map(),
  ): FinalMarketDecision[] {
    return this.finalDecisionEngine.decide(signals, calibrationBySelection);
  }
}
