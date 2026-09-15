export interface SettlementFixtureInput {
  eventId: string;

  homeTeamId: string;
  awayTeamId: string;

  finalHomeScore: number;
  finalAwayScore: number;

  halfTimeHomeScore: number | null;
  halfTimeAwayScore: number | null;
}
