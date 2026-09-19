// src/predictions-engine/interfaces/team-comparison-features.interface.ts

export interface TeamComparisonDimension {
  home: number;

  away: number;

  difference: number;

  strength: number;
}

export interface TeamComparisonFeatures {
  attack: TeamComparisonDimension;

  defence: TeamComparisonDimension;

  form: TeamComparisonDimension;

  venue: TeamComparisonDimension;

  standing: TeamComparisonDimension;

  overallStrength: TeamComparisonDimension;

  /*
   * Explicit opponent-adjusted competition strength.
   *
   * This prevents raw win/loss records from being interpreted
   * without considering the quality of opposition.
   */
  opponentAdjustedStrength: TeamComparisonDimension;

  goalProduction: TeamComparisonDimension;

  goalPrevention: TeamComparisonDimension;

  consistency: TeamComparisonDimension;

  homeAdvantage: number;

  awayAdvantage: number;

  directionalHomeScore: number;

  directionalAwayScore: number;

  directionalDifference: number;

  confidence: number;
}
