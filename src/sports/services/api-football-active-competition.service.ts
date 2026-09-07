import { Injectable, Logger } from '@nestjs/common';

import { ApiFootballService } from '../providers/api-football.service';

import { ApiFootballLeagueSeason } from '../providers/api-football.interfaces';

import { SupportedCompetitionService } from './supported-competition.service';

import { ActiveCompetitionService } from './active-competition.service';

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
    const supportedCompetitions =
      this.supportedCompetitionService.getWithApiFootball();

    const response = await this.apiFootballService.getCurrentLeagues();

    const apiFootballLeagues = response.response ?? [];

    const supportedByNameAndCountry = new Map<
      string,
      (typeof supportedCompetitions)[number]
    >();

    const supportedByName = new Map<
      string,
      (typeof supportedCompetitions)[number]
    >();

    for (const competition of supportedCompetitions) {
      const configuredName = competition.providers.apiFootballName?.trim();

      const configuredCountry =
        competition.providers.apiFootballCountry?.trim();

      if (!configuredName) {
        continue;
      }

      const normalizedName = this.normalizeName(configuredName);

      if (!supportedByName.has(normalizedName)) {
        supportedByName.set(normalizedName, competition);
      }

      if (configuredCountry) {
        supportedByNameAndCountry.set(
          this.buildNameCountryKey(normalizedName, configuredCountry),
          competition,
        );
      }
    }

    let matched = 0;
    let updated = 0;
    let skipped = 0;

    for (const providerLeague of apiFootballLeagues) {
      const leagueId = providerLeague.league?.id;

      const leagueName = providerLeague.league?.name;

      const countryName = providerLeague.country?.name;

      if (typeof leagueId !== 'number' || !leagueName?.trim()) {
        skipped += 1;
        continue;
      }

      const normalizedName = this.normalizeName(leagueName);

      const competition =
        (countryName
          ? supportedByNameAndCountry.get(
              this.buildNameCountryKey(normalizedName, countryName),
            )
          : undefined) ?? supportedByName.get(normalizedName);

      if (!competition) {
        continue;
      }

      const currentSeason = this.getCurrentSeason(providerLeague.seasons);

      if (
        currentSeason?.year === undefined ||
        !Number.isInteger(currentSeason.year)
      ) {
        skipped += 1;

        this.logger.warn(
          `No valid current season found for "${leagueName}" (${leagueId})`,
        );

        continue;
      }

      const seasonStartDate = this.parseDate(currentSeason.start);

      const seasonEndDate = this.parseDate(currentSeason.end);

      const status = this.calculateStatus(seasonStartDate, seasonEndDate);

      matched += 1;

      await this.activeCompetitionService.upsert(competition, {
        apiFootballLeagueId: leagueId,

        footballDataCode: competition.providers.footballDataCode,

        oddsApiSportKey: competition.providers.oddsApiSportKey,

        season: currentSeason.year,

        seasonStartDate,

        seasonEndDate,

        status,

        apiFootballPayload: providerLeague as unknown as Record<
          string,
          unknown
        >,
      });

      updated += 1;
    }

    this.logger.log(
      `API-Football competition discovery completed: ` +
        `discovered=${apiFootballLeagues.length}, ` +
        `matched=${matched}, ` +
        `updated=${updated}, ` +
        `skipped=${skipped}`,
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
        .filter(
          (season) =>
            typeof season.year === 'number' && Number.isInteger(season.year),
        )
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0]
    );
  }

  private calculateStatus(
    seasonStartDate?: Date,
    seasonEndDate?: Date,
    now = new Date(),
  ): ActiveCompetitionStatus {
    if (seasonStartDate && now < seasonStartDate) {
      return ActiveCompetitionStatus.UPCOMING;
    }

    if (seasonEndDate && now > seasonEndDate) {
      return ActiveCompetitionStatus.FINISHED;
    }

    if (
      seasonStartDate &&
      now >= seasonStartDate &&
      (!seasonEndDate || now <= seasonEndDate)
    ) {
      return ActiveCompetitionStatus.ACTIVE;
    }

    return ActiveCompetitionStatus.INACTIVE;
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

  private buildNameCountryKey(name: string, country: string): string {
    return `${name}::${this.normalizeName(country)}`;
  }
}
