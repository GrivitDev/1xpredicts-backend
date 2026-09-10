export interface ScorelineProbability {
  homeGoals: number;

  awayGoals: number;

  probability: number;
}

export interface GoalProbabilityDistribution {
  homeExpectedGoals: number;

  awayExpectedGoals: number;

  totalExpectedGoals: number;

  scorelines: ScorelineProbability[];

  homeGoals: Record<number, number>;

  awayGoals: Record<number, number>;

  totalGoals: Record<number, number>;
}

export interface MatchProbability {
  home: number;

  draw: number;

  away: number;
}

export interface SelectionProbability {
  selection: string;

  probability: number;

  confidence: number;
}
