// src/predictions-engine/interfaces/raw-team-features.interface.ts

export interface RawTeamVenueFeatures {
  sampleSize: number;

  wins: number;
  draws: number;
  losses: number;

  points: number;
  pointsPerMatch: number;

  goalsScored: number;
  goalsConceded: number;

  averageGoalsScored: number;
  averageGoalsConceded: number;

  winRate: number;
  drawRate: number;
  lossRate: number;

  bttsRate: number;

  cleanSheetRate: number;
  failedToScoreRate: number;

  over05Rate: number;
  over15Rate: number;
  over25Rate: number;
  over35Rate: number;
  over45Rate: number;
  over55Rate: number;
}

export interface RawTeamRecentFeatures {
  sampleSize: number;

  wins: number;
  draws: number;
  losses: number;

  points: number;
  pointsPerMatch: number;

  goalsScored: number;
  goalsConceded: number;

  averageGoalsScored: number;
  averageGoalsConceded: number;

  winRate: number;
  drawRate: number;
  lossRate: number;

  bttsRate: number;

  cleanSheetRate: number;
  failedToScoreRate: number;

  over05Rate: number;
  over15Rate: number;
  over25Rate: number;
  over35Rate: number;
  over45Rate: number;
  over55Rate: number;
}

export interface RawTeamHalfFeatures {
  sampleSize: number;

  goalsScored: number;
  goalsConceded: number;

  averageGoalsScored: number;
  averageGoalsConceded: number;
}

export interface RawTeamSourceData {
  competitionStats: Record<string, unknown>;

  performanceProfile: Record<string, unknown>;
}

export interface RawTeamFeatures {
  teamId: string;
  teamName: string;

  sampleSize: number;

  wins: number;
  draws: number;
  losses: number;

  points: number;
  pointsPerMatch: number;

  goalsScored: number;
  goalsConceded: number;

  averageGoalsScored: number;
  averageGoalsConceded: number;

  winRate: number;
  drawRate: number;
  lossRate: number;

  bttsRate: number;

  cleanSheetRate: number;
  failedToScoreRate: number;

  over05Rate: number;
  over15Rate: number;
  over25Rate: number;
  over35Rate: number;
  over45Rate: number;
  over55Rate: number;

  firstHalf: RawTeamHalfFeatures;
  secondHalf: RawTeamHalfFeatures;

  scoredFirstRate: number;

  recent: RawTeamRecentFeatures;

  venue: RawTeamVenueFeatures;

  /*
   * Sports-module datasets are preserved independently.
   *
   * Neither source replaces historical ESPN fixtures.
   * Neither source is reduced to a fallback-only role.
   */
  sourceData: RawTeamSourceData;

  historical: Array<{
    eventId: string;
    fixtureDate: Date;

    homeTeamId: string;
    awayTeamId: string;

    homeGoals: number;
    awayGoals: number;

    totalGoals: number;

    completed: boolean;
  }>;

  dataAvailability: {
    historicalMatches: boolean;
    recentForm: boolean;
    venueMatches: boolean;
    halfTimeData: boolean;
    scoredFirstData: boolean;

    competitionStats: boolean;
    performanceProfile: boolean;
  };
}
