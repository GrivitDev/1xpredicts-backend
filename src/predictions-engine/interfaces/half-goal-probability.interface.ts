export interface HalfGoalScore {
  totalGoals: number;
  probability: number;
}

export interface HalfGoalProbabilityDistribution {
  firstHalf: {
    totalGoals: Record<number, number>;
  };

  secondHalf: {
    totalGoals: Record<number, number>;
  };

  sampleSize: number;
}
