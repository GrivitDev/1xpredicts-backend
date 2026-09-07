import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { ApiFootballService } from '../providers/api-football.service';

import { ApiFootballLeagueSeason } from '../providers/api-football.interfaces';

import { SupportedCompetitionService } from './supported-competition.service';

import { ActiveCompetitionService } from './active-competition.service';

import { ActiveCompetitionStatus } from '../interfaces/active-competition.interface';

import {
  ApiFootballLeague,
  ApiFootballLeagueDocument,
} from '../schemas/api-football-league.schema';

import {
  SupportedCompetition,
  SupportedCompetitionDocument,
} from '../schemas/supported-competition.schema';

@Injectable()
export class ApiFootballActiveCompetitionService {
  private readonly logger = new Logger(
    ApiFootballActiveCompetitionService.name,
  );

  constructor(
    private readonly apiFootballService: ApiFootballService,

    private readonly supportedCompetitionService: SupportedCompetitionService,

    private readonly activeCompetitionService: ActiveCompetitionService,

    @InjectModel(ApiFootballLeague.name)
    private readonly apiFootballLeagueModel: Model<ApiFootballLeagueDocument>,

    @InjectModel(SupportedCompetition.name)
    private readonly supportedCompetitionModel: Model<SupportedCompetitionDocument>,
  ) {}

  async refreshCurrentCompetitions(): Promise<{
    discovered: number;
    supported: number;
    matched: number;
    updated: number;
    skipped: number;
  }> {
    // ============================================================
    // 1. ONE API-FOOTBALL CALL
    // ============================================================

    const response = await this.apiFootballService.getLeagues();

    const apiFootballLeagues = response.response ?? [];

    // ============================================================
    // 2. SAVE COMPLETE API-FOOTBALL CATALOG
    // ============================================================

    const now = new Date();

    const catalogOperations = apiFootballLeagues
      .filter(
        (league) =>
          typeof league.league?.id === 'number' &&
          Boolean(league.league?.name?.trim()),
      )
      .map((league) => ({
        updateOne: {
          filter: {
            apiFootballLeagueId: league.league!.id!,
          },
          update: {
            $set: {
              apiFootballLeagueId: league.league!.id!,
              name: league.league!.name!.trim(),
              type: league.league?.type ?? null,
              logo: league.league?.logo ?? null,
              country: league.country?.name ?? null,
              countryCode: league.country?.code ?? null,
              countryFlag: league.country?.flag ?? null,
              seasons: league.seasons ?? [],
              lastSyncedAt: now,
            },
          },
          upsert: true,
        },
      }));

    if (catalogOperations.length > 0) {
      await this.apiFootballLeagueModel.bulkWrite(catalogOperations);
    }

    // ============================================================
    // 3. SAVE OUR COMPLETE SUPPORTED COMPETITION LIST
    // ============================================================
    //
    // IMPORTANT:
    // Do not overwrite providers.apiFootballId.
    // That ID is our persistent provider mapping.
    // ============================================================

    const allSupportedCompetitions = this.supportedCompetitionService.getAll();

    const supportedOperations = allSupportedCompetitions.map((competition) => {
      const competitionId = competition.id.trim().toLowerCase();

      return {
        updateOne: {
          filter: {
            competitionId,
          },
          update: {
            $set: {
              competitionId,
              name: competition.name,
              type: competition.type,
              region: competition.region,
              priority: competition.priority,
              enabled: competition.enabled,
              predictionEnabled: competition.predictionEnabled,
              oddsEnabled: competition.oddsEnabled,
              collectionFrequency: competition.collectionFrequency,
              'providers.apiFootballName':
                competition.providers.apiFootballName ?? null,
              'providers.apiFootballCountry':
                competition.providers.apiFootballCountry ?? null,
              'providers.footballDataCode':
                competition.providers.footballDataCode ?? null,
              'providers.oddsApiSportKey':
                competition.providers.oddsApiSportKey ?? null,
              seasonal: competition.seasonal ?? false,
              gender: competition.gender ?? undefined,
              notes: competition.notes ?? null,
            },
          },
          upsert: true,
        },
      };
    });

    if (supportedOperations.length > 0) {
      await this.supportedCompetitionModel.bulkWrite(supportedOperations);
    }

    // ============================================================
    // 4. LOAD SUPPORTED COMPETITIONS THAT USE API-FOOTBALL
    // ============================================================

    const storedSupportedCompetitions = await this.supportedCompetitionModel
      .find({
        enabled: true,
        'providers.apiFootballName': {
          $exists: true,
          $ne: null,
        },
      })
      .lean()
      .exec();

    // ============================================================
    // 5. BUILD API-FOOTBALL LOOKUPS
    // ============================================================

    const apiLeagues = await this.apiFootballLeagueModel.find().lean().exec();

    const byId = new Map<number, (typeof apiLeagues)[number]>();

    const byNameAndCountry = new Map<string, (typeof apiLeagues)[number]>();

    const byName = new Map<string, (typeof apiLeagues)[number]>();

    for (const league of apiLeagues) {
      byId.set(league.apiFootballLeagueId, league);

      const normalizedName = this.normalizeName(league.name);

      if (!byName.has(normalizedName)) {
        byName.set(normalizedName, league);
      }

      if (league.country) {
        byNameAndCountry.set(
          this.buildNameCountryKey(normalizedName, league.country),
          league,
        );
      }
    }

    // ============================================================
    // 6. MATCH + CREATE ACTIVE COMPETITIONS
    // ============================================================

    let matched = 0;
    let updated = 0;
    let skipped = 0;

    const activeCompetitionIds: string[] = [];

    for (const storedCompetition of storedSupportedCompetitions) {
      const competitionId = storedCompetition.competitionId
        .trim()
        .toLowerCase();

      const configuredName =
        storedCompetition.providers?.apiFootballName?.trim();

      const configuredCountry =
        storedCompetition.providers?.apiFootballCountry?.trim();

      if (!configuredName) {
        skipped += 1;
        continue;
      }

      // ----------------------------------------------------------
      // First use an already discovered provider ID.
      // ----------------------------------------------------------

      let providerLeague =
        typeof storedCompetition.providers?.apiFootballId === 'number'
          ? byId.get(storedCompetition.providers.apiFootballId)
          : undefined;

      // ----------------------------------------------------------
      // Only perform name/country matching when no stored ID exists.
      // ----------------------------------------------------------

      if (!providerLeague) {
        const normalizedName = this.normalizeName(configuredName);

        providerLeague =
          (configuredCountry
            ? byNameAndCountry.get(
                this.buildNameCountryKey(normalizedName, configuredCountry),
              )
            : undefined) ?? byName.get(normalizedName);
      }

      if (!providerLeague) {
        skipped += 1;

        this.logger.warn(
          `No API-Football league match found for "${storedCompetition.name}"`,
        );

        continue;
      }

      const currentSeason = this.getCurrentSeason(providerLeague.seasons);

      if (
        currentSeason?.year === undefined ||
        !Number.isInteger(currentSeason.year)
      ) {
        skipped += 1;

        this.logger.warn(
          `No valid current season found for "${providerLeague.name}" ` +
            `(${providerLeague.apiFootballLeagueId})`,
        );

        continue;
      }

      matched += 1;

      // ----------------------------------------------------------
      // Save provider ID only when it has not already been stored.
      // ----------------------------------------------------------

      if (
        storedCompetition.providers?.apiFootballId !==
        providerLeague.apiFootballLeagueId
      ) {
        await this.supportedCompetitionModel.updateOne(
          {
            competitionId,
          },
          {
            $set: {
              'providers.apiFootballId': providerLeague.apiFootballLeagueId,
            },
          },
        );
      }

      const seasonStartDate = this.parseDate(currentSeason.start);

      const seasonEndDate = this.parseDate(currentSeason.end);

      const status = this.calculateStatus(seasonStartDate, seasonEndDate);

      const supportedCompetition =
        this.supportedCompetitionService.getById(competitionId);

      if (!supportedCompetition) {
        skipped += 1;

        continue;
      }

      await this.activeCompetitionService.upsert(supportedCompetition, {
        apiFootballLeagueId: providerLeague.apiFootballLeagueId,

        footballDataCode:
          supportedCompetition.providers.footballDataCode ?? undefined,

        oddsApiSportKey:
          supportedCompetition.providers.oddsApiSportKey ?? undefined,

        season: currentSeason.year,

        seasonStartDate,

        seasonEndDate,

        status,

        apiFootballPayload: providerLeague as unknown as Record<
          string,
          unknown
        >,
      });

      activeCompetitionIds.push(competitionId);

      updated += 1;
    }

    // ============================================================
    // 7. REMOVE ACTIVE COMPETITIONS THAT ARE NO LONGER MATCHED
    // ============================================================

    await this.activeCompetitionService.removeMissingCompetitions(
      activeCompetitionIds,
    );

    this.logger.log(
      `API-Football synchronization completed: ` +
        `catalog=${apiFootballLeagues.length}, ` +
        `supported=${storedSupportedCompetitions.length}, ` +
        `matched=${matched}, ` +
        `activeUpdated=${updated}, ` +
        `skipped=${skipped}`,
    );

    return {
      discovered: apiFootballLeagues.length,
      supported: storedSupportedCompetitions.length,
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
