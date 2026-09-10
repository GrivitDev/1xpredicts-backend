import { Injectable } from '@nestjs/common';

import { FixtureAnalysis } from '../interfaces/fixture-analysis.interface';

import {
  AiMarketDefinition,
  AiPredictionRequest,
} from '../interfaces/ai-prediction.interface';

import { PREDICTION_MARKET_DEFINITIONS } from '../markets/prediction-market.config';

@Injectable()
export class AiPredictionRequestService {
  build(fixtureAnalysis: FixtureAnalysis): AiPredictionRequest {
    const marketDefinitions: AiMarketDefinition[] =
      PREDICTION_MARKET_DEFINITIONS.map((definition) => ({
        market: definition.market,

        label: definition.label,

        selections: definition.selections.map((selection) => ({
          value: selection.value,
          label: selection.label,
        })),
      }));

    return {
      fixture: {
        fixtureId: fixtureAnalysis.fixture.fixtureId,

        competitionId: fixtureAnalysis.fixture.competitionId,

        leagueId: fixtureAnalysis.fixture.leagueId,

        season: fixtureAnalysis.fixture.season,

        kickoff: fixtureAnalysis.fixture.kickoff.toISOString(),

        homeTeam: {
          id: fixtureAnalysis.fixture.homeTeam.teamId,

          name: fixtureAnalysis.fixture.homeTeam.teamName,
        },

        awayTeam: {
          id: fixtureAnalysis.fixture.awayTeam.teamId,

          name: fixtureAnalysis.fixture.awayTeam.teamName,
        },
      },

      homeTeamStats: fixtureAnalysis.homeTeamStats
        ? (fixtureAnalysis.homeTeamStats as unknown as Record<string, unknown>)
        : null,

      awayTeamStats: fixtureAnalysis.awayTeamStats
        ? (fixtureAnalysis.awayTeamStats as unknown as Record<string, unknown>)
        : null,

      headToHead: fixtureAnalysis.headToHead
        ? (fixtureAnalysis.headToHead as unknown as Record<string, unknown>)
        : null,

      odds: fixtureAnalysis.odds
        ? (fixtureAnalysis.odds as unknown as Record<string, unknown>)
        : null,

      dataQuality: fixtureAnalysis.dataQuality,

      marketDefinitions,
    };
  }
}
