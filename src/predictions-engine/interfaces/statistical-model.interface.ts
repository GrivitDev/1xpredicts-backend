import { GoalProbabilityDistribution } from './prediction-probability.interface';

export interface ExpectedGoals {
  home: number;
  away: number;
  total: number;
}

export interface StatisticalModelOutput {
  expectedGoals: ExpectedGoals;

  matchProbability: {
    home: number;
    draw: number;
    away: number;
  };

  goalDistribution: GoalProbabilityDistribution;

  dataQuality: number;

  sampleQuality: number;

  reasonCodes: string[];

  generatedAt: Date;
}
