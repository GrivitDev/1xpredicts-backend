import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  EspnLeague,
  EspnLeagueDocument,
} from '../schemas/espn/espn-league.schema';

import { EspnService } from '../providers/espn.service';
import { ActiveCompetitionService } from './active-competition.service';
import { PriorityCompetitionService } from './priority-competition.service';

import { CompetitionPriority } from '../enums/competition-priority.enum';
import { CompetitionRegion } from '../enums/competition-region.enum';
import { CompetitionType } from '../enums/competition-type.enum';

import {
  EspnLeague as EspnLeaguePayload,
  EspnSeason,
} from '../providers/espn.interfaces';

interface LeagueSeasonData {
  season: number;
  startDate?: Date;
  endDate?: Date;
  payload: EspnSeason;
}

@Injectable()
export class EspnActiveCompetitionService {
  private readonly logger = new Logger(EspnActiveCompetitionService.name);

  constructor(
    private readonly espnService: EspnService,

    private readonly activeCompetitionService: ActiveCompetitionService,

    private readonly priorityCompetitionService: PriorityCompetitionService,

    @InjectModel(EspnLeague.name)
    private readonly espnLeagueModel: Model<EspnLeagueDocument>,
  ) {}

  // ============================================================
  // CATALOGUE DISCOVERY
  // ============================================================

  /**
   * Discover and store the complete ESPN league catalogue.
   *
   * This is intentionally the only normal operation that calls
   * ESPN's league catalogue endpoint.
   *
   * Called:
   * - once during startup
   * - again during the monthly catalogue refresh
   *
   * Daily collection uses the stored catalogue instead.
   */
  async synchronizeLeagueCatalogue(): Promise<EspnLeagueDocument[]> {
    const leagues = await this.espnService.getLeagues();

    if (!Array.isArray(leagues)) {
      throw new Error('ESPN league catalogue response was not an array');
    }

    const now = new Date();

    const operations = leagues
      .map((league) => this.buildCatalogueOperation(league, now))
      .filter(Boolean);

    if (operations.length > 0) {
      await this.espnLeagueModel.bulkWrite(operations as any[], {
        ordered: false,
      });
    }

    this.logger.log(`ESPN catalogue stored: ${operations.length} leagues`);

    return this.getOrderedLeagues();
  }

  // ============================================================
  // LEAGUE DETAILS
  // ============================================================

  /**
   * Process every stored ESPN league sequentially.
   *
   * This is the second stage of startup/monthly discovery:
   *
   * catalogue
   *   -> league details
   *   -> current season
   *   -> active/inactive
   *   -> priority
   *   -> active competition
   */
  async synchronizeLeagueDetails(): Promise<{
    processed: number;
    synchronized: number;
    active: number;
    inactive: number;
    skipped: number;
    failed: number;
  }> {
    const leagues = await this.getOrderedLeagues();

    let processed = 0;
    let synchronized = 0;
    let active = 0;
    let inactive = 0;
    let skipped = 0;
    let failed = 0;

    for (const league of leagues) {
      processed += 1;

      try {
        const result = await this.synchronizeLeagueDetail(league);

        if (!result) {
          skipped += 1;
          continue;
        }

        synchronized += 1;

        if (result.isActive) {
          active += 1;
        } else {
          inactive += 1;
        }
      } catch (error) {
        failed += 1;

        this.logger.error(
          `Failed to synchronize ESPN league detail ${league.leagueId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(
      `ESPN league details synchronized: ` +
        `processed=${processed}, ` +
        `synchronized=${synchronized}, ` +
        `active=${active}, ` +
        `inactive=${inactive}, ` +
        `skipped=${skipped}, ` +
        `failed=${failed}`,
    );

    return {
      processed,
      synchronized,
      active,
      inactive,
      skipped,
      failed,
    };
  }

  /**
   * Synchronize one stored league.
   *
   * The ESPN league detail response is the authoritative source
   * for the current season.
   */
  async synchronizeLeagueDetail(league: EspnLeagueDocument): Promise<{
    isActive: boolean;
    season?: number;
  } | null> {
    const leagueSlug =
      this.normalizeLeagueId(league.slug) ||
      this.normalizeLeagueId(league.leagueId);

    if (!leagueSlug) {
      this.logger.warn(
        `Skipping ESPN league without a usable slug/id: ${league.name}`,
      );

      return null;
    }

    const detail = await this.espnService.getLeague(leagueSlug);

    const season = this.extractLeagueSeason(detail);

    const priorityConfig = this.findPriorityCompetition(
      leagueSlug,
      league.leagueId,
    );

    const priority =
      priorityConfig?.priority ??
      this.getStoredPriority(league) ??
      CompetitionPriority.SELECTIVE;

    const region = priorityConfig?.region ?? this.getDefaultRegion(detail);

    const type = priorityConfig?.type ?? this.getDefaultCompetitionType();

    const normalizedSlug = this.normalizeLeagueId(detail.slug) || leagueSlug;

    /*
     * The catalogue leagueId remains the canonical MongoDB identity.
     */
    const canonicalLeagueId =
      this.normalizeLeagueId(league.leagueId) || leagueSlug;

    const name =
      this.getString(detail.name) ||
      this.getString(detail.displayName) ||
      league.name;

    const abbreviation =
      this.getString(detail.abbreviation) || league.abbreviation;

    const country = this.extractCountry(detail) || league.country;

    const now = new Date();

    /*
     * A season is active when its start date has arrived and its
     * end date has not passed.
     *
     * If ESPN gives no end date, an already-started season remains
     * active because there is no authoritative end date saying it
     * has finished.
     */
    const isActive = season
      ? this.isSeasonActive(season.startDate, season.endDate, now)
      : false;

    const update: Record<string, unknown> = {
      leagueId: canonicalLeagueId,
      slug: normalizedSlug,
      name,
      abbreviation,
      country,
      priority,
      isPriority: Boolean(priorityConfig),
      isActive,
      payload: detail,
      lastSyncedAt: now,
    };

    if (season) {
      update.season = season.season;
      update.seasonStartDate = season.startDate;
      update.seasonEndDate = season.endDate;
    } else {
      /*
       * No current season was returned by ESPN.
       *
       * Clear the active state because this detail pass is the
       * authoritative determination of whether this league has
       * a current active season.
       */
      update.isActive = false;
    }

    await this.espnLeagueModel.updateOne(
      {
        _id: league._id,
      },
      {
        $set: update,
      },
    );

    if (!season) {
      this.logger.warn(
        `ESPN league ${normalizedSlug} returned no current season; ` +
          `marked inactive and skipped active competition synchronization`,
      );

      return {
        isActive: false,
      };
    }

    await this.activeCompetitionService.syncLeague({
      competitionId: canonicalLeagueId,
      espnLeagueSlug: normalizedSlug,
      name,
      type,
      region,
      priority,

      footballDataCode: priorityConfig?.providers?.footballDataCode,

      oddsApiSportKey: priorityConfig?.providers?.oddsApiSportKey,

      season: season.season,
      seasonStartDate: season.startDate,
      seasonEndDate: season.endDate,

      espnPayload: detail,
    });

    return {
      isActive,
      season: season.season,
    };
  }

  // ============================================================
  // ACTIVE COMPETITIONS
  // ============================================================

  async syncActiveCompetitions(): Promise<void> {
    await this.synchronizeLeagueDetails();
  }

  async syncPriorityCompetition(leagueId: string): Promise<boolean> {
    const normalized = this.normalizeLeagueId(leagueId);

    if (!normalized) {
      return false;
    }

    let league = await this.getByLeagueId(normalized);

    if (!league) {
      league = await this.getBySlug(normalized);
    }

    if (!league) {
      return false;
    }

    return Boolean(await this.synchronizeLeagueDetail(league));
  }

  async refreshActiveCompetitionStatuses(): Promise<void> {
    await this.activeCompetitionService.refreshStatuses();
  }

  // ============================================================
  // LEAGUE READS
  // ============================================================

  async getActiveLeagues(): Promise<EspnLeagueDocument[]> {
    const leagues = await this.espnLeagueModel
      .find({
        isActive: true,
      })
      .lean()
      .exec();

    return this.sortLeaguesByPriority(leagues);
  }

  async getPriorityLeagues(): Promise<EspnLeagueDocument[]> {
    const leagues = await this.espnLeagueModel
      .find({
        isPriority: true,
        isActive: true,
      })
      .lean()
      .exec();

    return this.sortLeaguesByPriority(leagues);
  }

  /**
   * Returns the complete stored ESPN catalogue.
   *
   * SELECTIVE leagues remain stored and available.
   */
  async getOrderedLeagues(): Promise<EspnLeagueDocument[]> {
    const leagues = await this.espnLeagueModel.find().lean().exec();

    return this.sortLeaguesByPriority(leagues);
  }

  async getByLeagueId(leagueId: string): Promise<EspnLeagueDocument | null> {
    const normalized = this.normalizeLeagueId(leagueId);

    if (!normalized) {
      return null;
    }

    return this.espnLeagueModel
      .findOne({
        leagueId: normalized,
      })
      .lean()
      .exec();
  }

  async getBySlug(slug: string): Promise<EspnLeagueDocument | null> {
    const normalized = this.normalizeLeagueId(slug);

    if (!normalized) {
      return null;
    }

    return this.espnLeagueModel
      .findOne({
        slug: normalized,
      })
      .lean()
      .exec();
  }

  async updateLeagueActivity(
    leagueId: string,
    isActive: boolean,
  ): Promise<void> {
    const normalized = this.normalizeLeagueId(leagueId);

    if (!normalized) {
      return;
    }

    await this.espnLeagueModel.updateOne(
      {
        leagueId: normalized,
      },
      {
        $set: {
          isActive,
        },
      },
    );
  }

  // ============================================================
  // CATALOGUE OPERATION
  // ============================================================

  private buildCatalogueOperation(
    league: EspnLeaguePayload,
    now: Date,
  ): Record<string, unknown> | null {
    const leagueId =
      this.normalizeLeagueId(league.id) || this.normalizeLeagueId(league.slug);

    const slug = this.normalizeLeagueId(league.slug) || leagueId;

    if (!leagueId || !slug) {
      return null;
    }

    const priorityConfig = this.findPriorityCompetition(slug, leagueId);

    const priority = priorityConfig?.priority ?? CompetitionPriority.SELECTIVE;

    const name =
      this.getString(league.name) ||
      this.getString(league.displayName) ||
      this.getString(league.shortName) ||
      leagueId;

    const country = this.extractCountry(league);

    return {
      updateOne: {
        filter: {
          leagueId,
        },

        update: {
          $set: {
            leagueId,
            slug,
            name,
            abbreviation: this.getString(league.abbreviation),
            country,
            priority,
            isPriority: Boolean(priorityConfig),

            /*
             * Do NOT use catalogue discovery to determine activity.
             *
             * Existing activity is retained until the detail pass
             * resolves the new season. This prevents the catalogue
             * endpoint from falsely declaring every league active.
             */
            payload: league,
            lastSyncedAt: now,
          },

          $setOnInsert: {
            firstSeenAt: now,
            isActive: false,
          },
        },

        upsert: true,
      },
    };
  }

  // ============================================================
  // SEASON EXTRACTION
  // ============================================================

  private extractLeagueSeason(
    league: EspnLeaguePayload,
  ): LeagueSeasonData | null {
    const candidate = (
      league as EspnLeaguePayload & {
        season?: EspnSeason;
      }
    ).season;

    if (!candidate || typeof candidate !== 'object') {
      return null;
    }

    const seasonValue =
      typeof candidate.year === 'number'
        ? candidate.year
        : Number((candidate as Record<string, unknown>).year);

    if (!Number.isFinite(seasonValue)) {
      return null;
    }

    return {
      season: seasonValue,
      startDate: this.parseDate(candidate.startDate),
      endDate: this.parseDate(candidate.endDate),
      payload: candidate,
    };
  }

  private isSeasonActive(
    startDate?: Date,
    endDate?: Date,
    now = new Date(),
  ): boolean {
    if (startDate && now.getTime() < startDate.getTime()) {
      return false;
    }

    if (endDate && now.getTime() > endDate.getTime()) {
      return false;
    }

    /*
     * A season without a start date cannot be confidently classified
     * as currently active.
     */
    if (!startDate) {
      return false;
    }

    return true;
  }

  // ============================================================
  // PRIORITY
  // ============================================================

  private findPriorityCompetition(...identifiers: string[]) {
    const normalizedIdentifiers = identifiers
      .map((value) => this.normalizeLeagueId(value))
      .filter(Boolean);

    if (normalizedIdentifiers.length === 0) {
      return undefined;
    }

    return this.priorityCompetitionService.getAll().find((competition) => {
      const competitionId = this.normalizeLeagueId(competition.id);

      const espnSlug = this.normalizeLeagueId(
        competition.providers?.espnLeagueSlug,
      );

      return (
        normalizedIdentifiers.includes(competitionId) ||
        normalizedIdentifiers.includes(espnSlug)
      );
    });
  }

  private getPriorityRank(priority: CompetitionPriority): number {
    switch (priority) {
      case CompetitionPriority.ELITE:
        return 1;

      case CompetitionPriority.HIGH:
        return 2;

      case CompetitionPriority.REGIONAL:
        return 3;

      case CompetitionPriority.SELECTIVE:
      default:
        return 4;
    }
  }

  private sortLeaguesByPriority<T extends Record<string, any>>(
    leagues: T[],
  ): T[] {
    return [...leagues].sort((a, b) => {
      const priorityA = this.getPriorityRank(this.getStoredPriority(a));
      const priorityB = this.getPriorityRank(this.getStoredPriority(b));

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      const activeA = a.isActive ? 0 : 1;
      const activeB = b.isActive ? 0 : 1;

      if (activeA !== activeB) {
        return activeA - activeB;
      }

      const nameA = typeof a.name === 'string' ? a.name : '';
      const nameB = typeof b.name === 'string' ? b.name : '';

      return nameA.localeCompare(nameB);
    });
  }

  private getStoredPriority(league: Record<string, any>): CompetitionPriority {
    if (Object.values(CompetitionPriority).includes(league.priority)) {
      return league.priority as CompetitionPriority;
    }

    return CompetitionPriority.SELECTIVE;
  }

  // ============================================================
  // DEFAULT CLASSIFICATION
  // ============================================================

  private getDefaultRegion(league: EspnLeaguePayload): CompetitionRegion {
    const country = this.extractCountry(league);

    if (country && country.toLowerCase() === 'nigeria') {
      return CompetitionRegion.NIGERIA;
    }

    return CompetitionRegion.EUROPE;
  }

  private getDefaultCompetitionType(): CompetitionType {
    return CompetitionType.LEAGUE;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private extractCountry(league: EspnLeaguePayload): string | undefined {
    // Treat the external payload as unknown so generated typings cannot
    // narrow this value to never in the string branch.
    const country: unknown = (league as { country?: unknown }).country;

    if (typeof country === 'string') {
      return this.getString(country);
    }

    if (country && typeof country === 'object') {
      const value = country as Record<string, unknown>;

      return (
        this.getString(value.name) ??
        this.getString(value.displayName) ??
        this.getString(value.abbreviation)
      );
    }

    return undefined;
  }

  private getString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();

    return normalized || undefined;
  }

  private parseDate(value: unknown): Date | undefined {
    if (typeof value !== 'string' && !(value instanceof Date)) {
      return undefined;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return date;
  }

  private normalizeLeagueId(value?: string): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }
}
