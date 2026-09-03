import { Injectable } from '@nestjs/common';

import {
  SUPPORTED_COMPETITIONS,
  getSupportedCompetition,
} from '../config/supported-competitions.config';

import { SupportedCompetitionConfig } from '../interfaces/supported-competition-config.interface';

import { CompetitionPriority } from '../enums/competition-priority.enum';

import { CompetitionRegion } from '../enums/competition-region.enum';

import { CompetitionType } from '../enums/competition-type.enum';

import { CollectionFrequency } from '../enums/collection-frequency.enum';

import {
  getCompetitionCounts,
  getCompetitionsByFrequency,
  getCompetitionsByPriority,
  getCompetitionsByRegion,
  getCompetitionsByType,
  getEnabledCompetitions,
  getHighValueCompetitions,
  getPredictionCompetitions,
  getOddsCompetitions,
  getNewsCompetitions,
  getSupportedLeagues,
  getClubCompetitions,
  getInternationalCompetitions,
  hasApiFootballMapping,
  hasFootballDataMapping,
  hasSportsDbMapping,
  hasOddsApiMapping,
} from '../utils/competition.utils';

@Injectable()
export class SupportedCompetitionService {
  private readonly competitions = SUPPORTED_COMPETITIONS;

  getAll(): SupportedCompetitionConfig[] {
    return [...this.competitions];
  }

  getById(competitionId: string): SupportedCompetitionConfig | undefined {
    return getSupportedCompetition(competitionId);
  }

  getEnabled(): SupportedCompetitionConfig[] {
    return getEnabledCompetitions(this.competitions);
  }

  getPredictionEnabled(): SupportedCompetitionConfig[] {
    return getPredictionCompetitions(this.competitions);
  }

  getOddsEnabled(): SupportedCompetitionConfig[] {
    return getOddsCompetitions(this.competitions);
  }

  getNewsEnabled(): SupportedCompetitionConfig[] {
    return getNewsCompetitions(this.competitions);
  }

  getByType(type: CompetitionType): SupportedCompetitionConfig[] {
    return getCompetitionsByType(this.competitions, type);
  }

  getByRegion(region: CompetitionRegion): SupportedCompetitionConfig[] {
    return getCompetitionsByRegion(this.competitions, region);
  }

  getByPriority(priority: CompetitionPriority): SupportedCompetitionConfig[] {
    return getCompetitionsByPriority(this.competitions, priority);
  }

  getByFrequency(frequency: CollectionFrequency): SupportedCompetitionConfig[] {
    return getCompetitionsByFrequency(this.competitions, frequency);
  }

  getDaily(): SupportedCompetitionConfig[] {
    return this.getByFrequency(CollectionFrequency.DAILY);
  }

  getWeekly(): SupportedCompetitionConfig[] {
    return this.getByFrequency(CollectionFrequency.WEEKLY);
  }

  getTargeted(): SupportedCompetitionConfig[] {
    return this.getByFrequency(CollectionFrequency.TARGETED);
  }

  getSeasonal(): SupportedCompetitionConfig[] {
    return this.competitions.filter(
      (competition) => competition.seasonal === true,
    );
  }

  getLeagues(): SupportedCompetitionConfig[] {
    return getSupportedLeagues(this.competitions);
  }

  getClubCompetitions(): SupportedCompetitionConfig[] {
    return getClubCompetitions(this.competitions);
  }

  getInternationalCompetitions(): SupportedCompetitionConfig[] {
    return getInternationalCompetitions(this.competitions);
  }

  getHighValue(): SupportedCompetitionConfig[] {
    return getHighValueCompetitions(this.competitions);
  }

  getWithApiFootball(): SupportedCompetitionConfig[] {
    return this.competitions.filter(hasApiFootballMapping);
  }

  getWithFootballData(): SupportedCompetitionConfig[] {
    return this.competitions.filter(hasFootballDataMapping);
  }

  getWithSportsDb(): SupportedCompetitionConfig[] {
    return this.competitions.filter(hasSportsDbMapping);
  }

  getWithOddsApi(): SupportedCompetitionConfig[] {
    return this.competitions.filter(hasOddsApiMapping);
  }

  getConfigCount() {
    return getCompetitionCounts(this.competitions);
  }

  isSupported(competitionId: string): boolean {
    return Boolean(this.getById(competitionId));
  }
}
