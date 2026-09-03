import { Injectable, Logger } from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { SupportedCompetitionService } from '../../sports/services/supported-competition.service';

import { TavilyService } from '../../tavily/tavily.service';

import {
  AiLeagueIntelligence,
  AiLeagueIntelligenceDocument,
} from './ai-league-intelligence.schema';

interface AiLeague {
  id: string;
  name: string;
  code: string;
  country?: string;
  type?: string;
  region?: string;
}

@Injectable()
export class AiLeagueIntelligenceService {
  private readonly logger = new Logger(AiLeagueIntelligenceService.name);

  constructor(
    @InjectModel(AiLeagueIntelligence.name)
    private readonly model: Model<AiLeagueIntelligenceDocument>,

    private readonly supportedCompetitionService: SupportedCompetitionService,

    private readonly tavilyService: TavilyService,
  ) {}

  // ==========================================================
  // GET AVAILABLE LEAGUES
  // ==========================================================

  getAvailableLeagues(): Promise<AiLeague[]> {
    return Promise.resolve(
      this.supportedCompetitionService
        .getAll()
        .filter(
          (competition) => competition.type === 'LEAGUE' && competition.enabled,
        )
        .map((competition) => ({
          id: competition.id,

          name: competition.name,

          code: competition.providers.footballDataCode ?? competition.id,

          country: competition.region,

          type: competition.type,

          region: competition.region,
        })),
    );
  }

  // ==========================================================
  // DAILY CACHE DATE
  // ==========================================================

  private getCacheDate(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  // ==========================================================
  // FIND LEAGUE NEEDING RESEARCH
  // ==========================================================

  async findNextLeagueToResearch(
    leagues: AiLeague[],
  ): Promise<AiLeague | null> {
    const cacheDate = this.getCacheDate();

    for (const league of leagues) {
      if (!league?.code || !league?.name) {
        continue;
      }

      const existing = await this.model.findOne({
        leagueCode: league.code,

        cacheDate,

        expiresAt: {
          $gt: new Date(),
        },
      });

      if (!existing) {
        return league;
      }
    }

    return null;
  }

  // ==========================================================
  // RESEARCH LEAGUE
  // ==========================================================

  async researchLeague(
    league: AiLeague,
  ): Promise<AiLeagueIntelligenceDocument> {
    if (!league?.code || !league?.name) {
      throw new Error('League code and name are required for research');
    }

    const cacheDate = this.getCacheDate();

    const query = this.buildLeagueQuery(league);

    this.logger.log(`Researching league: ${league.name} (${league.code})`);

    const result = await this.tavilyService.searchCurrentNews(query, 8);

    const searchedAt = new Date();

    const expiresAt = new Date(searchedAt.getTime() + 24 * 60 * 60 * 1000);

    const document = await this.model.findOneAndUpdate(
      {
        leagueCode: league.code,

        cacheDate,
      },

      {
        $set: {
          leagueCode: league.code,

          leagueName: league.name,

          country: league.country ?? 'Unknown',

          cacheDate,

          query,

          results: result.results.map((item) => ({
            title: item.title,

            url: item.url,

            content: item.content,

            publishedDate: item.publishedDate,

            score: item.score,
          })),

          images: result.images,

          searchedAt,

          expiresAt,
        },
      },

      {
        upsert: true,

        new: true,

        setDefaultsOnInsert: true,
      },
    );

    if (!document) {
      throw new Error(`Failed to cache intelligence for ${league.name}`);
    }

    this.logger.log(
      `League research cached: ${league.name} ` +
        `(${result.results.length} sources, ${result.images.length} images)`,
    );

    return document;
  }

  // ==========================================================
  // GET CACHED LEAGUE INTELLIGENCE
  // ==========================================================

  async getLeagueIntelligence(
    leagueCode: string,
  ): Promise<AiLeagueIntelligenceDocument | null> {
    if (!leagueCode?.trim()) {
      return null;
    }

    return this.model
      .findOne({
        leagueCode: leagueCode.trim(),

        expiresAt: {
          $gt: new Date(),
        },
      })
      .sort({
        searchedAt: -1,
      })
      .lean();
  }

  // ==========================================================
  // QUERY
  // ==========================================================

  private buildLeagueQuery(league: AiLeague): string {
    return `
${league.name} ${league.country || ''} football latest news today.

Find the most relevant current information about this competition,
including important team news, injuries, suspensions, player
availability, expected lineups, manager developments, transfers,
major upcoming matches, major results, tactical developments and
other information that could affect upcoming football matches.

Prioritize official league and club information, UEFA, FIFA,
national football associations, established broadcasters,
reputable sports journalism and reliable football sources.

Return recent and relevant information only.
Do not focus on old stories unless they are still directly relevant.
    `.trim();
  }
}
