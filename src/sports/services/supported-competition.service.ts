import { Injectable } from '@nestjs/common';

import {
  SUPPORTED_COMPETITIONS,
  getSupportedCompetition,
} from '../config/supported-competitions.config';

import { CollectionFrequency } from '../enums/collection-frequency.enum';

import { CompetitionPriority } from '../enums/competition-priority.enum';

import { CompetitionRegion } from '../enums/competition-region.enum';

import { CompetitionType } from '../enums/competition-type.enum';

import { SupportedCompetitionConfig } from '../interfaces/supported-competition-config.interface';

import {
  getActiveMensCompetitions,
  getClubCompetitions,
  getCompetitionCounts,
  getCompetitionsByFrequency,
  getCompetitionsByPriority,
  getCompetitionsByRegion,
  getCompetitionsByType,
  getDailyCompetitions,
  getEnabledCompetitions,
  getHighValueCompetitions,
  getInternationalCompetitions,
  getOddsCompetitions,
  getPredictionCompetitions,
  getSeasonalCompetitions,
  getSupportedLeagues,
  hasApiFootballMapping,
  hasFootballDataMapping,
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
    return getDailyCompetitions(this.competitions);
  }

  getSeasonal(): SupportedCompetitionConfig[] {
    return getSeasonalCompetitions(this.competitions);
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

  getActiveMens(): SupportedCompetitionConfig[] {
    return getActiveMensCompetitions(this.competitions);
  }

  getWithApiFootball(): SupportedCompetitionConfig[] {
    return this.competitions.filter(hasApiFootballMapping);
  }

  getWithFootballData(): SupportedCompetitionConfig[] {
    return this.competitions.filter(hasFootballDataMapping);
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
