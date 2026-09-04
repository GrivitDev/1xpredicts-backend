import { CompetitionPriority } from '../enums/competition-priority.enum';

import { CompetitionRegion } from '../enums/competition-region.enum';

import { CompetitionType } from '../enums/competition-type.enum';

import { CollectionFrequency } from '../enums/collection-frequency.enum';

export type SupportedCompetitionId = string;

export interface CompetitionProviderMapping {
  apiFootballName?: string;

  apiFootballCountry?: string;

  apiFootballId?: number;

  footballDataCode?: string;

  sportsDbLeagueId?: number;

  oddsApiSportKey?: string;
}

export interface SupportedCompetitionConfig {
  id: SupportedCompetitionId;

  name: string;

  type: CompetitionType;

  region: CompetitionRegion;

  priority: CompetitionPriority;

  enabled: boolean;

  predictionEnabled: boolean;

  oddsEnabled: boolean;

  newsEnabled: boolean;

  collectionFrequency: CollectionFrequency;

  providers: CompetitionProviderMapping;

  seasonal?: boolean;

  gender?: 'MEN' | 'WOMEN';

  notes?: string;
}
