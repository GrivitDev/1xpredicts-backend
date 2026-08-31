// src/ai/predictions/ai-prediction-data.service.ts

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { FootballDataService } from '../../sports/football-data.service';

import { Match } from '../../sports/interfaces/match.interface';

import { AiLeagueIntelligenceService } from '../league-intelligence/ai-league-intelligence.service';

import {
  AiLeagueResearch,
  AiPredictionMatchInput,
  AiRecentMatch,
  AiTeamSnapshot,
} from './ai-prediction.interfaces';

@Injectable()
export class AiPredictionDataService {
  private readonly logger = new Logger(AiPredictionDataService.name);

  constructor(
    private readonly footballDataService: FootballDataService,

    private readonly aiLeagueIntelligenceService: AiLeagueIntelligenceService,
  ) {}

  // ==========================================================
  // BUILD MATCH INPUT
  // ==========================================================

  async buildMatchInput(matchId: string): Promise<AiPredictionMatchInput> {
    if (!matchId?.trim()) {
      throw new BadRequestException('matchId is required');
    }

    const match = await this.footballDataService.getMatchDetails(matchId);

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    let homeTeamData: AiTeamSnapshot | undefined;

    let awayTeamData: AiTeamSnapshot | undefined;

    // ========================================================
    // STANDINGS
    // ========================================================

    try {
      const standings = await this.footballDataService.getStandings(
        match.leagueCode,
      );

      const table = this.extractStandingTable(standings);

      homeTeamData = this.findTeamSnapshot(table, match.homeTeam);

      awayTeamData = this.findTeamSnapshot(table, match.awayTeam);
    } catch (error) {
      this.logger.warn(
        `Unable to load standings for ${match.leagueCode}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // ========================================================
    // FINISHED RESULTS
    // ========================================================

    let leagueMatches: Match[] = [];

    try {
      leagueMatches = await this.footballDataService.getFinishedMatches(
        match.leagueCode,
      );
    } catch (error) {
      this.logger.warn(
        `Unable to load league results for ${match.leagueCode}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // ========================================================
    // CACHED TAVILY RESEARCH
    // ========================================================

    let leagueResearch: AiLeagueResearch | undefined;

    try {
      const cached =
        await this.aiLeagueIntelligenceService.getLeagueIntelligence(
          match.leagueCode,
        );

      if (cached) {
        leagueResearch = {
          leagueCode: cached.leagueCode,

          leagueName: cached.leagueName,

          country: cached.country,

          cacheDate: cached.cacheDate,

          searchedAt: cached.searchedAt,

          expiresAt: cached.expiresAt,

          results: cached.results.map((item) => ({
            title: item.title,

            url: item.url,

            content: item.content,

            publishedDate: item.publishedDate,

            score: item.score,
          })),

          images: cached.images || [],
        };
      }
    } catch (error) {
      this.logger.warn(
        `Unable to load cached league intelligence for ${match.leagueCode}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      matchId: match.id,

      leagueCode: match.leagueCode,

      leagueName: match.league?.name,

      country: match.league?.country,

      homeTeam: match.homeTeam,

      awayTeam: match.awayTeam,

      matchDate: match.date,

      kickoffTimestamp: match.kickoffTimestamp,

      venue: match.venue,

      stage: match.stage,

      homeTeamData,

      awayTeamData,

      homeRecentMatches: this.getTeamRecentMatches(
        leagueMatches,
        match.homeTeam,
      ),

      awayRecentMatches: this.getTeamRecentMatches(
        leagueMatches,
        match.awayTeam,
      ),

      headToHead: this.getHeadToHead(
        leagueMatches,
        match.homeTeam,
        match.awayTeam,
      ),

      leagueResearch,

      additionalNews: [],

      additionalContext: '',
    };
  }

  // ==========================================================
  // STANDING TABLE
  // ==========================================================

  private extractStandingTable(standings: any): any[] {
    if (Array.isArray(standings?.table)) {
      return standings.table;
    }

    if (Array.isArray(standings?.groups)) {
      return standings.groups.flatMap((group: any) =>
        Array.isArray(group.table) ? group.table : [],
      );
    }

    return [];
  }

  // ==========================================================
  // TEAM SNAPSHOT
  // ==========================================================

  private findTeamSnapshot(
    table: any[],
    teamName: string,
  ): AiTeamSnapshot | undefined {
    const normalized = this.normalizeTeamName(teamName);

    const team = table.find((entry) => {
      const current = this.normalizeTeamName(entry.team);

      return (
        current === normalized ||
        current.includes(normalized) ||
        normalized.includes(current)
      );
    });

    if (!team) {
      return undefined;
    }

    return {
      name: team.team,

      position: this.toOptionalNumber(team.position),

      points: this.toOptionalNumber(team.points),

      playedGames: this.toOptionalNumber(team.playedGames),

      won: this.toOptionalNumber(team.won),

      draw: this.toOptionalNumber(team.draw),

      lost: this.toOptionalNumber(team.lost),

      goalsFor: this.toOptionalNumber(team.goalsFor),

      goalsAgainst: this.toOptionalNumber(team.goalsAgainst),

      goalDifference: this.toOptionalNumber(team.goalDifference),

      form: team.form ?? null,
    };
  }

  // ==========================================================
  // RECENT MATCHES
  // ==========================================================

  private getTeamRecentMatches(
    matches: Match[],
    teamName: string,
  ): AiRecentMatch[] {
    const target = this.normalizeTeamName(teamName);

    return matches
      .filter((match) => {
        const home = this.normalizeTeamName(match.homeTeam);

        const away = this.normalizeTeamName(match.awayTeam);

        return home === target || away === target;
      })
      .sort((a, b) => b.kickoffTimestamp - a.kickoffTimestamp)
      .slice(0, 5)
      .map((match) => ({
        matchId: match.id,

        homeTeam: match.homeTeam,

        awayTeam: match.awayTeam,

        homeScore: match.homeScore ?? null,

        awayScore: match.awayScore ?? null,

        date: match.date,

        status: match.status,
      }));
  }

  // ==========================================================
  // HEAD TO HEAD
  // ==========================================================

  private getHeadToHead(
    matches: Match[],
    homeTeam: string,
    awayTeam: string,
  ): AiRecentMatch[] {
    const home = this.normalizeTeamName(homeTeam);

    const away = this.normalizeTeamName(awayTeam);

    return matches
      .filter((match) => {
        const matchHome = this.normalizeTeamName(match.homeTeam);

        const matchAway = this.normalizeTeamName(match.awayTeam);

        return (
          (matchHome === home && matchAway === away) ||
          (matchHome === away && matchAway === home)
        );
      })
      .sort((a, b) => b.kickoffTimestamp - a.kickoffTimestamp)
      .slice(0, 5)
      .map((match) => ({
        matchId: match.id,

        homeTeam: match.homeTeam,

        awayTeam: match.awayTeam,

        homeScore: match.homeScore ?? null,

        awayScore: match.awayScore ?? null,

        date: match.date,

        status: match.status,
      }));
  }

  // ==========================================================
  // TEAM NAME
  // ==========================================================

  private normalizeTeamName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ==========================================================
  // NUMBER
  // ==========================================================

  private toOptionalNumber(value: unknown): number | undefined {
    const number = Number(value);

    return Number.isFinite(number) ? number : undefined;
  }
}
