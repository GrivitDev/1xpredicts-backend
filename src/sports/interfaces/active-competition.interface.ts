export enum ActiveCompetitionStatus {
  UPCOMING = 'UPCOMING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  FINISHED = 'FINISHED',
}

export interface ActiveCompetition {
  competitionId: string;
  name: string;
  type: string;
  region: string;
  priority: number;

  apiFootballLeagueId?: number;
  sportsDbLeagueId?: number;

  season?: string;

  seasonStartDate?: Date;
  seasonEndDate?: Date;

  status: ActiveCompetitionStatus;

  lastFixtureDate?: Date;
  nextFixtureDate?: Date;
  lastUpdatedAt?: Date;
}
