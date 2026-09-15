export interface RawHeadToHeadFeatures {
  available: boolean;
  sampleSize: number;

  homeWins: number;
  draws: number;
  awayWins: number;

  averageGoalsForHome: number;
  averageGoalsForAway: number;
  averageGoalsForTeam: number;

  averageTotalGoals: number;

  bttsRate: number;
  cleanSheetHomeRate: number;
  cleanSheetAwayRate: number;

  failedToScoreHomeRate: number;
  failedToScoreAwayRate: number;

  over05Rate: number;
  over15Rate: number;
  over25Rate: number;
  over35Rate: number;
  over45Rate: number;
  over55Rate: number;

  homeScoredFirstRate: number;
  awayScoredFirstRate: number;

  dataReliability: number;
}
