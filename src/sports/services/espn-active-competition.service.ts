import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { EspnService } from '../providers/espn.service';
import {
  EspnLeague,
  EspnLeagueDocument,
} from '../schemas/espn/espn-league.schema';

import { ActiveCompetitionService } from './active-competition.service';
import { PriorityCompetitionService } from './priority-competition.service';

import { CompetitionPriority } from '../enums/competition-priority.enum';

import { SupportedCompetitionConfig } from '../interfaces/supported-competition-config.interface';
import { CompetitionRegion } from '../enums/competition-region.enum';
import { CompetitionType } from '../enums/competition-type.enum';

@Injectable()
export class EspnActiveCompetitionService {
  private readonly logger = new Logger(EspnActiveCompetitionService.name);

  private getQueuePriority(priority?: CompetitionPriority): number {
    switch (priority) {
      case CompetitionPriority.ELITE:
        return 1;

      case CompetitionPriority.HIGH:
        return 2;

      case CompetitionPriority.REGIONAL:
        return 3;

      case CompetitionPriority.SELECTIVE:
        return 4;

      default:
        return 99;
    }
  }
  constructor(
    private readonly espnService: EspnService,

    private readonly activeCompetitionService: ActiveCompetitionService,

    private readonly priorityCompetitionService: PriorityCompetitionService,

    @InjectModel(EspnLeague.name)
    private readonly espnLeagueModel: Model<EspnLeagueDocument>,
  ) {}

  /**
   * Synchronize the complete ESPN league catalogue into MongoDB.
   *
   * ESPN is the source of truth for the league catalogue.
   * Priority classification comes from PriorityCompetitionService.
   */
  async synchronizeLeagueCatalogue(): Promise<EspnLeague[]> {
    const leagues = await this.espnService.getLeagues();

    const now = new Date();
    const operations = leagues.map((league: Record<string, unknown>) => {
      const rawLeagueId = league.slug ?? league.id;
      const leagueId = this.normalizeLeagueId(
        typeof rawLeagueId === 'string' || typeof rawLeagueId === 'number'
          ? String(rawLeagueId)
          : '',
      );
      const name =
        typeof league.name === 'string'
          ? league.name
          : typeof league.abbreviation === 'string'
            ? league.abbreviation
            : leagueId;
      const slug = typeof league.slug === 'string' ? league.slug : leagueId;
      const abbreviation =
        typeof league.abbreviation === 'string'
          ? league.abbreviation
          : undefined;
      const country =
        typeof league.country === 'string'
          ? league.country
          : typeof league.location === 'string'
            ? league.location
            : undefined;

      const priorityConfig = this.findPriorityCompetition(leagueId);

      return {
        updateOne: {
          filter: {
            leagueId,
          },
          update: {
            $set: {
              leagueId,
              name,
              slug,
              abbreviation,
              country,
              region: priorityConfig?.region ?? CompetitionRegion.EUROPE,
              isPriority: Boolean(priorityConfig),
              priority: priorityConfig?.priority,
              priorityRank: priorityConfig
                ? this.getPriorityRank(priorityConfig.priority)
                : 99,
              isActive: true,
              payload: league,
              lastSyncedAt: now,
            },
            $setOnInsert: {
              firstSeenAt: now,
            },
          },
          upsert: true,
        },
      };
    });

    if (operations.length > 0) {
      await this.espnLeagueModel.bulkWrite(operations, {
        ordered: false,
      });
    }

    return this.getOrderedLeagues();
  }

  /**
   * Return all active ESPN leagues ordered by priority first.
   */
  async getActiveLeagues(): Promise<EspnLeague[]> {
    return this.espnLeagueModel
      .find({
        isActive: true,
      })
      .sort({
        priorityRank: 1,
        name: 1,
      })
      .lean<EspnLeague[]>()
      .exec();
  }

  /**
   * Return priority ESPN leagues only.
   */
  async getPriorityLeagues(): Promise<EspnLeague[]> {
    return this.espnLeagueModel
      .find({
        isActive: true,
        isPriority: true,
      })
      .sort({
        priorityRank: 1,
        name: 1,
      })
      .lean<EspnLeague[]>()
      .exec();
  }

  /**
   * Return all active leagues with priority leagues first.
   */
  async getOrderedLeagues(): Promise<EspnLeague[]> {
    return this.espnLeagueModel
      .find({
        isActive: true,
      })
      .sort({
        priorityRank: 1,
        name: 1,
      })
      .lean<EspnLeague[]>()
      .exec();
  }

  async getByLeagueId(leagueId: string): Promise<EspnLeague | null> {
    return this.espnLeagueModel
      .findOne({
        leagueId: this.normalizeLeagueId(leagueId),
      })
      .lean<EspnLeague>()
      .exec();
  }

  async getBySlug(slug: string): Promise<EspnLeague | null> {
    return this.espnLeagueModel
      .findOne({
        $or: [
          {
            leagueId: this.normalizeLeagueId(slug),
          },
          {
            slug: this.normalizeLeagueId(slug),
          },
        ],
      })
      .lean()
      .exec();
  }

  /**
   * Update the active state of an ESPN league.
   */
  async updateLeagueActivity(
    leagueId: string,
    isActive: boolean,
  ): Promise<void> {
    await this.espnLeagueModel.updateOne(
      {
        leagueId: this.normalizeLeagueId(leagueId),
      },
      {
        $set: {
          isActive,
          lastSyncedAt: new Date(),
        },
      },
    );
  }

  /**
   * Synchronize MongoDB active-competition records from the ESPN catalogue.
   */
  async syncActiveCompetitions(): Promise<void> {
    const leagues = await this.getActiveLeagues();

    for (const league of leagues) {
      await this.syncActiveCompetition(league);
    }

    this.logger.log(`Synchronized ${leagues.length} active ESPN leagues`);
  }

  /**
   * Synchronize one priority competition.
   */
  async syncPriorityCompetition(competitionId: string): Promise<void> {
    const config = this.findPriorityCompetition(competitionId);

    if (!config) {
      return;
    }

    const league = await this.getByLeagueId(competitionId);

    if (!league) {
      return;
    }

    await this.syncActiveCompetition(league);
  }

  /**
   * Synchronize one ESPN league into the generic active-competition collection.
   */
  async syncActiveCompetition(league: EspnLeague): Promise<void> {
    const priorityConfig = this.findPriorityCompetition(league.leagueId);

    await this.activeCompetitionService.upsert({
      competitionId: league.leagueId,
      name: league.name,
      priority: priorityConfig?.priority ?? CompetitionPriority.SELECTIVE,
      region: CompetitionRegion.NIGERIA,
      type: CompetitionType.LEAGUE,
      espnLeagueSlug: '',
    });
  }

  /**
   * Refresh activity state for the current ESPN catalogue.
   */
  async refreshActiveCompetitionStatuses(): Promise<void> {
    const leagues = await this.getActiveLeagues();

    for (const league of leagues) {
      const config = this.findPriorityCompetition(league.leagueId);

      const isPriority = Boolean(config);

      if (
        league.isPriority !== isPriority ||
        league.priority !== config?.priority
      ) {
        await this.espnLeagueModel.updateOne(
          {
            _id: league._id,
          },
          {
            $set: {
              isPriority,
              priority: config?.priority,
              priorityRank: config ? this.getPriorityRank(config.priority) : 99,
              lastSyncedAt: new Date(),
            },
          },
        );
      }
    }
  }

  /**
   * Find a priority configuration using the centralized priority registry.
   *
   * Matching is performed against the configured competition ID and
   * ESPN league ID/slug in normalized form.
   */
  private findPriorityCompetition(
    leagueId: string,
  ): SupportedCompetitionConfig | undefined {
    const normalized = this.normalizeLeagueId(leagueId);

    return this.priorityCompetitionService.getAll().find((competition) => {
      const configuredId = this.normalizeLeagueId(String(competition.id ?? ''));

      return configuredId === normalized;
    });
  }

  private getPriorityRank(priority?: CompetitionPriority): number {
    return this.getQueuePriority(priority);
  }

  private normalizeLeagueId(value: string): string {
    return value.trim().toLowerCase();
  }
}
