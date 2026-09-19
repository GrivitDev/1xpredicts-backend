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

export interface RawTeamOpponentAdjustedFeatures {
  available: boolean;

  sampleSize: number;

  effectiveSampleSize: number;

  /*
   * Difficulty of the opponents faced, 0-100.
   *
   * 50 = approximately neutral competition strength.
   */
  scheduleStrength: number;

  /*
   * Current-season pre-match competition rating translated
   * to a 0-100 football-strength scale.
   */
  strengthRating: number;

  /*
   * Historical team output after weighting matches according
   * to opponent strength and recency.
   */
  averageGoalsScored: number;

  averageGoalsConceded: number;

  pointsPerMatch: number;

  winRate: number;

  lossRate: number;
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
   * Opponent-adjusted historical evidence.
   */
  opponentAdjusted: RawTeamOpponentAdjustedFeatures;

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

    opponentAdjustedData: boolean;
  };
}
