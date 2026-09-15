export type NumericMap = Record<string, number>;

export interface MatchDerivedDataInput {
  eventId: string;

  competitionId: string;

  season: number;

  fixtureDate: Date;

  homeTeamId: string;

  homeTeamName: string;

  awayTeamId: string;

  awayTeamName: string;

  homeProfile: Record<string, unknown>;

  awayProfile: Record<string, unknown>;

  homeTeamStats: Record<string, unknown>;

  awayTeamStats: Record<string, unknown>;

  headToHead: Record<string, unknown>;

  leagueContext: Record<string, unknown>;

  expectedHomeGoals: number;

  expectedAwayGoals: number;

  expectedTotalGoals: number;

  expectedGoalModel: Record<string, unknown>;

  exactScoreProbabilities: NumericMap;

  homeGoalsProbabilities: NumericMap;

  awayGoalsProbabilities: NumericMap;

  totalGoalsProbabilities: NumericMap;

  marketProbabilities: NumericMap;

  firstHalfProbabilities: NumericMap;

  secondHalfProbabilities: NumericMap;

  halfTimeFullTimeProbabilities: NumericMap;

  scoringFirstProbabilities: NumericMap;

  // ============================================================
  // DATA QUALITY
  // ============================================================

  dataCompletenessScore: number;

  statisticalReliabilityScore: number;

  marketDataQualityScore?: number;

  overallDataQualityScore: number;

  dataSources: string[];

  calculatedAt: Date;
}
