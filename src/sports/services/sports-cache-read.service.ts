import { Injectable } from '@nestjs/common';

import { SportsRedisService } from '../cache/sports-redis.service';

import { SPORTS_CACHE_KEYS } from '../cache/sports-cache.constants';

@Injectable()
export class SportsCacheReadService {
  constructor(private readonly redisService: SportsRedisService) {}

  // ============================================================
  // GENERIC
  // ============================================================

  async get<T>(key: string): Promise<T | null> {
    return this.redisService.get<T>(key);
  }

  // ============================================================
  // PUBLIC SPORTS DATA
  // ============================================================

  async getLive<T>(): Promise<T | null> {
    return this.redisService.get<T>(SPORTS_CACHE_KEYS.live());
  }

  async getFixtures<T>(competitionId: string): Promise<T | null> {
    return this.redisService.get<T>(SPORTS_CACHE_KEYS.fixtures(competitionId));
  }

  async getResults<T>(competitionId: string): Promise<T | null> {
    return this.redisService.get<T>(SPORTS_CACHE_KEYS.results(competitionId));
  }

  async getStandings<T>(competitionId: string): Promise<T | null> {
    return this.redisService.get<T>(SPORTS_CACHE_KEYS.standings(competitionId));
  }

  async getCompetitions<T>(): Promise<T | null> {
    return this.redisService.get<T>(SPORTS_CACHE_KEYS.competitions());
  }

  async getTeams<T>(competitionId: string): Promise<T | null> {
    return this.redisService.get<T>(SPORTS_CACHE_KEYS.teams(competitionId));
  }

  async getActiveCompetitions<T>(): Promise<T | null> {
    return this.redisService.get<T>(SPORTS_CACHE_KEYS.activeCompetitions());
  }

  // ============================================================
  // API-FOOTBALL
  // ============================================================

  async getApiFootballFixtures<T>(
    leagueId: number,
    season: number,
  ): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.apiFootballFixtures(leagueId, season),
    );
  }

  async getApiFootballStandings<T>(
    leagueId: number,
    season: number,
  ): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.apiFootballStandings(leagueId, season),
    );
  }

  async getApiFootballTeamStatistics<T>(
    leagueId: number,
    season: number,
    teamId: number,
  ): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.apiFootballTeamStatistics(leagueId, season, teamId),
    );
  }

  async getApiFootballInjuries<T>(
    leagueId: number,
    season: number,
  ): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.apiFootballInjuries(leagueId, season),
    );
  }

  async getApiFootballPrediction<T>(fixtureId: number): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.apiFootballPrediction(fixtureId),
    );
  }

  // ============================================================
  // THE SPORTS DB
  // ============================================================

  async getTheSportsDbSeason<T>(
    leagueId: number,
    season: string,
  ): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.theSportsDbSeason(leagueId, season),
    );
  }

  async getTheSportsDbEvents<T>(leagueId: number): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.theSportsDbEvents(leagueId),
    );
  }

  async getTheSportsDbEvent<T>(eventId: number): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.theSportsDbEvent(eventId),
    );
  }

  async getTheSportsDbTimeline<T>(eventId: number): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.theSportsDbTimeline(eventId),
    );
  }

  async getTheSportsDbLineup<T>(eventId: number): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.theSportsDbLineup(eventId),
    );
  }

  async getTheSportsDbStatistics<T>(eventId: number): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.theSportsDbStatistics(eventId),
    );
  }

  async getTheSportsDbTeams<T>(leagueId: number): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.theSportsDbTeams(leagueId),
    );
  }

  async getTheSportsDbPlayers<T>(teamId: number): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.theSportsDbPlayers(teamId),
    );
  }

  async getTheSportsDbPlayerStatistics<T>(
    playerId: number,
    teamId: number,
  ): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.theSportsDbPlayerStatistics(playerId, teamId),
    );
  }

  async getTheSportsDbVenue<T>(venueId: number): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.theSportsDbVenue(venueId),
    );
  }

  // ============================================================
  // ODDS API
  // ============================================================

  async getOddsEvents<T>(sportKey: string): Promise<T | null> {
    return this.redisService.get<T>(SPORTS_CACHE_KEYS.oddsEvents(sportKey));
  }

  async getOddsScores<T>(sportKey: string): Promise<T | null> {
    return this.redisService.get<T>(SPORTS_CACHE_KEYS.oddsScores(sportKey));
  }

  async getOdds<T>(eventId: string): Promise<T | null> {
    return this.redisService.get<T>(SPORTS_CACHE_KEYS.odds(eventId));
  }

  // ============================================================
  // YOUTUBE
  // ============================================================

  async getYoutubeHighlight<T>(fixtureId: string): Promise<T | null> {
    return this.redisService.get<T>(
      SPORTS_CACHE_KEYS.youtubeHighlight(fixtureId),
    );
  }
}
