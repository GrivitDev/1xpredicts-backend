import { CompetitionPriority } from '../enums/competition-priority.enum';
import { CompetitionRegion } from '../enums/competition-region.enum';
import { CompetitionType } from '../enums/competition-type.enum';
import { CollectionFrequency } from '../enums/collection-frequency.enum';

export type SupportedCompetitionId = string;

export interface CompetitionProviderMapping {
  /**
   * Provider-specific competition/league identifier.
   *
   * We intentionally keep these optional until the provider
   * mappings have been verified against their current APIs.
   */
  apiFootballId?: number;

  footballDataCode?: string;

  sportsDbLeagueId?: number;

  oddsApiSportKey?: string;
}

export interface SupportedCompetitionConfig {
  /**
   * Stable internal identifier.
   */
  id: SupportedCompetitionId;

  /**
   * Human-readable name.
   */
  name: string;

  /**
   * League / club competition / international.
   */
  type: CompetitionType;

  /**
   * Geographic classification.
   */
  region: CompetitionRegion;

  /**
   * Resource priority.
   */
  priority: CompetitionPriority;

  /**
   * Whether the source collector should currently
   * consider this competition.
   */
  enabled: boolean;

  /**
   * Whether prediction generation is allowed.
   */
  predictionEnabled: boolean;

  /**
   * Whether odds should be collected.
   */
  oddsEnabled: boolean;

  /**
   * Whether Tavily/content research may use this
   * competition as a news target.
   *
   * This does not connect Tavily to the prediction pipeline.
   */
  newsEnabled: boolean;

  /**
   * Normal collection frequency.
   */
  collectionFrequency: CollectionFrequency;

  /**
   * Expected provider mappings.
   */
  providers: CompetitionProviderMapping;

  /**
   * Optional metadata for special competitions.
   */
  seasonal?: boolean;

  /**
   * Optional men's/women's classification.
   */
  gender?: 'MEN' | 'WOMEN';

  /**
   * Optional notes for collector behavior.
   */
  notes?: string;
}
