import { Injectable, Logger } from '@nestjs/common';

import { ApiFootballService } from '../providers/api-football.service';

import { ApiFootballLeagueSeason } from '../providers/api-football.interfaces';

import { SupportedCompetitionService } from './supported-competition.service';

import { ActiveCompetitionService } from './active-competition.service';

import { SupportedCompetitionConfig } from '../interfaces/supported-competition-config.interface';
import { ActiveCompetitionStatus } from '../interfaces/active-competition.interface';

@Injectable()
export class ApiFootballActiveCompetitionService {
  private readonly logger = new Logger(
    ApiFootballActiveCompetitionService.name,
  );

  constructor(
    private readonly apiFootballService: ApiFootballService,
    private readonly supportedCompetitionService: SupportedCompetitionService,
    private readonly activeCompetitionService: ActiveCompetitionService,
  ) {}

  async refreshCurrentCompetitions(): Promise<{
    discovered: number;
    matched: number;
    updated: number;
    skipped: number;
  }> {
    const supportedCompetitions = this.supportedCompetitionService.getAll();

    const apiFootballLeagues =
      await this.apiFootballService.getCurrentLeagues();

    const supportedByName = new Map<string, SupportedCompetitionConfig>();

    for (const competition of supportedCompetitions) {
      const configuredName =
        competition.providers.apiFootballName?.trim() ||
        competition.name.trim();

      if (!configuredName) {
        continue;
      }

      supportedByName.set(this.normalizeName(configuredName), competition);
    }

    let matched = 0;
    let updated = 0;
    let skipped = 0;

    for (const providerLeague of apiFootballLeagues) {
      const leagueId = providerLeague.league?.id;
      const leagueName = providerLeague.league?.name;

      if (leagueId === undefined || !leagueName || leagueName.trim() === '') {
        skipped++;
        continue;
      }

      const competition = supportedByName.get(this.normalizeName(leagueName));

      if (!competition) {
        continue;
      }

      const currentSeason = this.getCurrentSeason(providerLeague.seasons);

      if (!currentSeason?.year) {
        skipped++;

        this.logger.warn(
          `No current season found for supported API-Football competition "${leagueName}" (${leagueId}).`,
        );

        continue;
      }

      matched++;

      await this.activeCompetitionService.upsert(competition, {
        apiFootballLeagueId: leagueId,
        season: String(currentSeason.year),
        seasonStartDate: this.parseDate(currentSeason.start),
        seasonEndDate: this.parseDate(currentSeason.end),
        status: ActiveCompetitionStatus.UPCOMING,
      });

      updated++;
    }

    this.logger.log(
      `API-Football competition discovery completed: discovered=${apiFootballLeagues.length}, matched=${matched}, updated=${updated}, skipped=${skipped}`,
    );

    return {
      discovered: apiFootballLeagues.length,
      matched,
      updated,
      skipped,
    };
  }

  private getCurrentSeason(
    seasons?: ApiFootballLeagueSeason[],
  ): ApiFootballLeagueSeason | undefined {
    if (!seasons?.length) {
      return undefined;
    }

    return (
      seasons.find((season) => season.current === true) ??
      seasons
        .filter((season) => typeof season.year === 'number')
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0]
    );
  }

  private parseDate(value?: string | null): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private normalizeName(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }
}
