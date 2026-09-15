export interface RawHistoricalMatchFeatures {
  eventId: string;
  fixtureDate: Date;

  homeTeamId: string;
  awayTeamId: string;

  homeGoals: number;
  awayGoals: number;

  totalGoals: number;

  completed: boolean;
}
