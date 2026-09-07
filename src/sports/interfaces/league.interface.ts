import { CompetitionPriority } from '../enums/competition-priority.enum';

import { CompetitionRegion } from '../enums/competition-region.enum';

import { CompetitionType } from '../enums/competition-type.enum';

import { CompetitionProviderMapping } from './supported-competition-config.interface';

export interface SportsLeague {
  id: string;

  name: string;

  type: CompetitionType;

  region: CompetitionRegion;

  priority: CompetitionPriority;

  enabled: boolean;

  predictionEnabled: boolean;

  oddsEnabled: boolean;

  collectionFrequency: string;

  providers: CompetitionProviderMapping;
}
