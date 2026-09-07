import { CompetitionPriority } from '../enums/competition-priority.enum';

import { CompetitionRegion } from '../enums/competition-region.enum';

import { CompetitionType } from '../enums/competition-type.enum';

export enum ActiveCompetitionStatus {
  UPCOMING = 'UPCOMING',

  ACTIVE = 'ACTIVE',

  INACTIVE = 'INACTIVE',

  FINISHED = 'FINISHED',
}

export interface ActiveCompetition {
  /**
   * Stable internal competition ID.
   */
  competitionId: string;

  name: string;

  type: CompetitionType;

  region: CompetitionRegion;

  priority: CompetitionPriority;

  /**
   * Runtime API-Football mapping.
   */
  apiFootballLeagueId?: number;

  /**
   * Runtime Football-Data mapping.
   */
  footballDataCode?: string;

  /**
   * Runtime Odds API mapping.
   */
  oddsApiSportKey?: string;

  /**
   * Current provider season.
   */
  season?: number;

  seasonStartDate?: Date;

  seasonEndDate?: Date;

  /**
   * Latest known fixture for this competition.
   */
  lastFixtureDate?: Date;

  /**
   * Next known fixture for this competition.
   */
  nextFixtureDate?: Date;

  status: ActiveCompetitionStatus;

  /**
   * Complete latest API-Football league discovery payload.
   */
  apiFootballPayload?: Record<string, unknown>;

  lastUpdatedAt?: Date;
}
