export interface PredictionRunTeam {
  id: string;
  name: string;
}

export interface PredictionRunInput {
  eventId: string;
  competitionId: string;
  season: number;
  fixtureDate: Date;

  homeTeam: PredictionRunTeam;
  awayTeam: PredictionRunTeam;
}
