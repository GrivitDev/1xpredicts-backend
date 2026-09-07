import { CollectionFrequency } from '../enums/collection-frequency.enum';
import { CompetitionPriority } from '../enums/competition-priority.enum';
import { CompetitionRegion } from '../enums/competition-region.enum';
import { CompetitionType } from '../enums/competition-type.enum';

export interface SupportedCompetitionConfig {
  id: string;
  name: string;

  type: CompetitionType;
  region: CompetitionRegion;
  priority: CompetitionPriority;

  enabled: boolean;

  predictionEnabled: boolean;
  oddsEnabled: boolean;

  collectionFrequency: CollectionFrequency;

  providers: {
    apiFootballName?: string;
    apiFootballCountry?: string;
    apiFootballId?: number;

    footballDataCode?: string;

    oddsApiSportKey?: string;
  };

  seasonal?: boolean;
  gender?: 'MEN' | 'WOMEN';

  notes?: string;
}

export interface CompetitionProviderMapping {
  apiFootballName?: string;
  apiFootballCountry?: string;
  apiFootballId?: number;
  footballDataCode?: string;
  oddsApiSportKey?: string;
}
