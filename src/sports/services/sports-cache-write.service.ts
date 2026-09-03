import { Injectable } from '@nestjs/common';

import { SportsRedisService } from '../cache/sports-redis.service';

import {
  SPORTS_CACHE_KEYS,
  SPORTS_CACHE_TTL,
} from '../cache/sports-cache.constants';

@Injectable()
export class SportsCacheWriteService {
  constructor(private readonly redisService: SportsRedisService) {}

  // ============================================================
  // GENERIC
  // ============================================================

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    await this.redisService.set(key, value, ttl);
  }

  async delete(key: string): Promise<void> {
    await this.redisService.delete(key);
  }

  // ============================================================
  // FRONTEND CACHE
  // ============================================================

  async setFixtures<T>(competitionId: string, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.fixtures(competitionId),
      value,
      SPORTS_CACHE_TTL.FIXTURES,
    );
  }

  async setResults<T>(competitionId: string, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.results(competitionId),
      value,
      SPORTS_CACHE_TTL.RESULTS,
    );
  }

  async setStandings<T>(competitionId: string, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.standings(competitionId),
      value,
      SPORTS_CACHE_TTL.STANDINGS,
    );
  }

  async setCompetitions<T>(value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.competitions(),
      value,
      SPORTS_CACHE_TTL.COMPETITIONS,
    );
  }

  async setTeams<T>(competitionId: string, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.teams(competitionId),
      value,
      SPORTS_CACHE_TTL.TEAMS,
    );
  }

  async setLive<T>(value: T): Promise<void> {
    await this.set(SPORTS_CACHE_KEYS.live(), value, SPORTS_CACHE_TTL.LIVE);
  }

  async setActiveCompetitions<T>(value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.activeCompetitions(),
      value,
      SPORTS_CACHE_TTL.ACTIVE_COMPETITIONS,
    );
  }

  // ============================================================
  // API-FOOTBALL CACHE
  // ============================================================

  async setApiFootballFixtures<T>(
    leagueId: number,
    season: number,
    value: T,
  ): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.apiFootballFixtures(leagueId, season),
      value,
      SPORTS_CACHE_TTL.API_FOOTBALL,
    );
  }

  async setApiFootballStandings<T>(
    leagueId: number,
    season: number,
    value: T,
  ): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.apiFootballStandings(leagueId, season),
      value,
      SPORTS_CACHE_TTL.API_FOOTBALL,
    );
  }

  async setApiFootballTeamStatistics<T>(
    leagueId: number,
    season: number,
    teamId: number,
    value: T,
  ): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.apiFootballTeamStatistics(leagueId, season, teamId),
      value,
      SPORTS_CACHE_TTL.API_FOOTBALL,
    );
  }

  async setApiFootballInjuries<T>(
    leagueId: number,
    season: number,
    value: T,
  ): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.apiFootballInjuries(leagueId, season),
      value,
      SPORTS_CACHE_TTL.API_FOOTBALL,
    );
  }

  async setApiFootballPrediction<T>(
    fixtureId: number,
    value: T,
  ): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.apiFootballPrediction(fixtureId),
      value,
      SPORTS_CACHE_TTL.API_FOOTBALL,
    );
  }

  // ============================================================
  // THE SPORTS DB CACHE
  // ============================================================

  async setTheSportsDbEvent<T>(eventId: number, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.theSportsDbEvent(eventId),
      value,
      SPORTS_CACHE_TTL.THESPORTSDB,
    );
  }

  async setTheSportsDbEvents<T>(leagueId: number, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.theSportsDbEvents(leagueId),
      value,
      SPORTS_CACHE_TTL.THESPORTSDB,
    );
  }

  async setTheSportsDbTimeline<T>(eventId: number, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.theSportsDbTimeline(eventId),
      value,
      SPORTS_CACHE_TTL.THESPORTSDB,
    );
  }

  async setTheSportsDbLineup<T>(eventId: number, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.theSportsDbLineup(eventId),
      value,
      SPORTS_CACHE_TTL.THESPORTSDB,
    );
  }

  async setTheSportsDbStatistics<T>(eventId: number, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.theSportsDbStatistics(eventId),
      value,
      SPORTS_CACHE_TTL.THESPORTSDB,
    );
  }

  async setTheSportsDbTeams<T>(leagueId: number, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.theSportsDbTeams(leagueId),
      value,
      SPORTS_CACHE_TTL.THESPORTSDB,
    );
  }

  async setTheSportsDbPlayers<T>(teamId: number, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.theSportsDbPlayers(teamId),
      value,
      SPORTS_CACHE_TTL.THESPORTSDB,
    );
  }

  async setTheSportsDbPlayerStatistics<T>(
    playerId: number,
    teamId: number,
    value: T,
  ): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.theSportsDbPlayerStatistics(playerId, teamId),
      value,
      SPORTS_CACHE_TTL.THESPORTSDB,
    );
  }

  async setTheSportsDbVenue<T>(venueId: number, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.theSportsDbVenue(venueId),
      value,
      SPORTS_CACHE_TTL.THESPORTSDB,
    );
  }

  async setTheSportsDbSeason<T>(
    leagueId: number,
    season: string,
    value: T,
  ): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.theSportsDbSeason(leagueId, season),
      value,
      SPORTS_CACHE_TTL.THESPORTSDB,
    );
  }

  // ============================================================
  // ODDS CACHE
  // ============================================================

  async setOddsSports<T>(value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.oddsSports(),
      value,
      SPORTS_CACHE_TTL.ODDS_SPORTS,
    );
  }

  async setOddsEvents<T>(sportKey: string, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.oddsEvents(sportKey),
      value,
      SPORTS_CACHE_TTL.ODDS_EVENTS,
    );
  }

  async setOddsScores<T>(sportKey: string, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.oddsScores(sportKey),
      value,
      SPORTS_CACHE_TTL.LIVE,
    );
  }

  async setOdds<T>(eventId: string, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.odds(eventId),
      value,
      SPORTS_CACHE_TTL.ODDS,
    );
  }

  // ============================================================
  // YOUTUBE
  // ============================================================

  async setYoutubeHighlight<T>(fixtureId: string, value: T): Promise<void> {
    await this.set(
      SPORTS_CACHE_KEYS.youtubeHighlight(fixtureId),
      value,
      SPORTS_CACHE_TTL.YOUTUBE,
    );
  }

  // ============================================================
  // INVALIDATION
  // ============================================================

  async invalidateFixtures(competitionId: string): Promise<void> {
    await this.delete(SPORTS_CACHE_KEYS.fixtures(competitionId));
  }

  async invalidateResults(competitionId: string): Promise<void> {
    await this.delete(SPORTS_CACHE_KEYS.results(competitionId));
  }

  async invalidateStandings(competitionId: string): Promise<void> {
    await this.delete(SPORTS_CACHE_KEYS.standings(competitionId));
  }

  async invalidateCompetitions(): Promise<void> {
    await this.delete(SPORTS_CACHE_KEYS.competitions());
  }

  async invalidateTeams(competitionId: string): Promise<void> {
    await this.delete(SPORTS_CACHE_KEYS.teams(competitionId));
  }

  async invalidateLive(): Promise<void> {
    await this.delete(SPORTS_CACHE_KEYS.live());
  }

  async invalidateActiveCompetitions(): Promise<void> {
    await this.delete(SPORTS_CACHE_KEYS.activeCompetitions());
  }

  async clearSportsCache(): Promise<void> {
    await this.redisService.deleteByPrefix('2xpredict:sports:');
  }
}
