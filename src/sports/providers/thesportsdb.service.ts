import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import axios, { AxiosError, AxiosInstance } from 'axios';

import {
  SportsDbEvent,
  SportsDbEventResult,
  SportsDbLineupPlayer,
  SportsDbPlayer,
  SportsDbPlayerStatistic,
  SportsDbStatistic,
  SportsDbTeam,
  SportsDbTimelineEvent,
  SportsDbVenue,
} from './thesportsdb.interfaces';

import { SportsProviderRateLimitService } from '../services/sports-provider-rate-limit.service';

@Injectable()
export class TheSportsDbService implements OnModuleInit {
  private readonly baseUrl = 'https://www.thesportsdb.com/api/v1/json';

  private http!: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    private readonly providerRateLimitService: SportsProviderRateLimitService,
  ) {}

  onModuleInit(): void {
    const apiKey =
      this.configService.get<string>('THESPORTSDB_API_KEY') ?? '123';

    this.http = axios.create({
      baseURL: `${this.baseUrl}/${apiKey}`,
      timeout: 15_000,
      headers: {
        Accept: 'application/json',
      },
    });
  }

  // ============================================================
  // LEAGUE / SEASON EVENTS
  // ============================================================

  async getSeasonEvents(
    leagueId: number,
    season: string,
  ): Promise<SportsDbEvent[]> {
    this.validateId(leagueId, 'leagueId');

    if (!season?.trim()) {
      throw new BadRequestException('season is required');
    }

    const data = await this.request<Record<string, unknown>>(
      '/eventsseason.php',
      {
        id: leagueId,
        s: season,
      },
    );

    return this.toArray<SportsDbEvent>(data.events);
  }

  // ============================================================
  // EVENT
  // ============================================================

  async getEvent(eventId: number): Promise<SportsDbEvent | null> {
    this.validateId(eventId, 'eventId');

    const data = await this.request<Record<string, unknown>>(
      '/lookupevent.php',
      {
        id: eventId,
      },
    );

    return this.toArray<SportsDbEvent>(data.events)[0] ?? null;
  }

  // ============================================================
  // EVENT RESULTS
  // ============================================================

  async getEventResults(eventId: number): Promise<SportsDbEventResult[]> {
    this.validateId(eventId, 'eventId');

    const data = await this.request<Record<string, unknown>>(
      '/eventresults.php',
      {
        id: eventId,
      },
    );

    return this.toArray<SportsDbEventResult>(data.results);
  }

  // ============================================================
  // EVENT TIMELINE
  // ============================================================

  async getEventTimeline(eventId: number): Promise<SportsDbTimelineEvent[]> {
    this.validateId(eventId, 'eventId');

    const data = await this.request<Record<string, unknown>>(
      '/lookuptimeline.php',
      {
        id: eventId,
      },
    );

    return this.toArray<SportsDbTimelineEvent>(data.timeline);
  }

  // ============================================================
  // EVENT LINEUP
  // ============================================================

  async getEventLineup(eventId: number): Promise<SportsDbLineupPlayer[]> {
    this.validateId(eventId, 'eventId');

    const data = await this.request<Record<string, unknown>>(
      '/lookuplineup.php',
      {
        id: eventId,
      },
    );

    return this.toArray<SportsDbLineupPlayer>(data.lineup);
  }

  // ============================================================
  // EVENT STATISTICS
  // ============================================================

  async getEventStatistics(eventId: number): Promise<SportsDbStatistic[]> {
    this.validateId(eventId, 'eventId');

    const data = await this.request<Record<string, unknown>>(
      '/lookupeventstats.php',
      {
        id: eventId,
      },
    );

    return this.toArray<SportsDbStatistic>(data.statistics);
  }

  // ============================================================
  // LEAGUE TEAMS
  // ============================================================

  async getLeagueTeams(leagueId: number): Promise<SportsDbTeam[]> {
    this.validateId(leagueId, 'leagueId');

    const data = await this.request<Record<string, unknown>>(
      '/lookup_all_teams.php',
      {
        id: leagueId,
      },
    );

    return this.toArray<SportsDbTeam>(data.teams);
  }

  // ============================================================
  // TEAM
  // ============================================================

  async getTeam(teamId: number): Promise<SportsDbTeam | null> {
    this.validateId(teamId, 'teamId');

    const data = await this.request<Record<string, unknown>>(
      '/lookupteam.php',
      {
        id: teamId,
      },
    );

    return this.toArray<SportsDbTeam>(data.teams)[0] ?? null;
  }

  // ============================================================
  // TEAM NEXT EVENTS
  // ============================================================

  async getTeamNextEvents(teamId: number): Promise<SportsDbEvent[]> {
    this.validateId(teamId, 'teamId');

    const data = await this.request<Record<string, unknown>>(
      '/eventsnext.php',
      {
        id: teamId,
      },
    );

    return this.toArray<SportsDbEvent>(data.events);
  }

  // ============================================================
  // TEAM PREVIOUS EVENTS
  // ============================================================

  async getTeamPreviousEvents(teamId: number): Promise<SportsDbEvent[]> {
    this.validateId(teamId, 'teamId');

    const data = await this.request<Record<string, unknown>>(
      '/eventslast.php',
      {
        id: teamId,
      },
    );

    return this.toArray<SportsDbEvent>(data.events);
  }

  // ============================================================
  // TEAM PLAYERS
  // ============================================================

  async getTeamPlayers(teamId: number): Promise<SportsDbPlayer[]> {
    this.validateId(teamId, 'teamId');

    const data = await this.request<Record<string, unknown>>(
      '/lookup_all_players.php',
      {
        id: teamId,
      },
    );

    return this.toArray<SportsDbPlayer>(data.player);
  }

  // ============================================================
  // PLAYER
  // ============================================================

  async getPlayer(playerId: number): Promise<SportsDbPlayer | null> {
    this.validateId(playerId, 'playerId');

    const data = await this.request<Record<string, unknown>>(
      '/lookupplayer.php',
      {
        id: playerId,
      },
    );

    return this.toArray<SportsDbPlayer>(data.players)[0] ?? null;
  }

  // ============================================================
  // PLAYER STATISTICS
  // ============================================================

  async getPlayerStatistics(
    playerId: number,
  ): Promise<SportsDbPlayerStatistic[]> {
    this.validateId(playerId, 'playerId');

    const data = await this.request<Record<string, unknown>>(
      '/lookupplayerstat.php',
      {
        id: playerId,
      },
    );

    return this.toArray<SportsDbPlayerStatistic>(data.playerstatistics);
  }

  // ============================================================
  // VENUE
  // ============================================================

  async getVenue(venueId: number): Promise<SportsDbVenue | null> {
    this.validateId(venueId, 'venueId');

    const data = await this.request<Record<string, unknown>>(
      '/lookupvenue.php',
      {
        id: venueId,
      },
    );

    return this.toArray<SportsDbVenue>(data.venues)[0] ?? null;
  }

  // ============================================================
  // REQUEST
  // ============================================================

  private async request<T>(
    endpoint: string,
    params: Record<string, string | number>,
  ): Promise<T> {
    return this.providerRateLimitService.execute('thesportsdb', async () => {
      try {
        const response = await this.http.get<T>(endpoint, {
          params,
        });

        return response.data;
      } catch (error) {
        this.logApiError(error, endpoint);

        throw new InternalServerErrorException(
          `TheSportsDB request failed: ${endpoint}`,
        );
      }
    });
  }

  // ============================================================
  // ARRAY HELPER
  // ============================================================

  private toArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }

  // ============================================================
  // VALIDATION
  // ============================================================

  private validateId(value: number, field: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
  }

  // ============================================================
  // LOGGING
  // ============================================================

  private logApiError(error: unknown, endpoint: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      console.error('TheSportsDB error', {
        endpoint,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });

      return;
    }

    console.error('TheSportsDB error', {
      endpoint,
      error,
    });
  }
}
