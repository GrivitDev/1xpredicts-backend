export interface RawStandingTeamFeatures {
  teamId: string;

  rank: number;
  points: number;
  played: number;

  wins: number;
  draws: number;
  losses: number;

  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;

  form: string | null;
}

export interface RawStandingFeatures {
  home: RawStandingTeamFeatures | null;
  away: RawStandingTeamFeatures | null;
}
