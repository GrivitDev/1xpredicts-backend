import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import axios, { AxiosError, AxiosInstance } from 'axios';

import {
  ApiFootballFixture,
  ApiFootballInjury,
  ApiFootballLeagueResponse,
  ApiFootballPrediction,
  ApiFootballResponse,
  ApiFootballStandingResponse,
  ApiFootballTeamStatisticsResponse,
} from './api-football.interfaces';

@Injectable()
export class ApiFootballService implements OnModuleInit {
  private readonly baseUrl = 'https://v3.football.api-sports.io';

  private http!: AxiosInstance;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.configService.get<string>('API_FOOTBALL_KEY');

    if (!apiKey) {
      throw new Error('API_FOOTBALL_KEY is missing');
    }

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        'x-apisports-key': apiKey,
        Accept: 'application/json',
      },
    });
  }

  // ============================================================
  // CURRENT LEAGUES
  // ============================================================

  async getCurrentLeagues(): Promise<ApiFootballLeagueResponse[]> {
    const data = await this.request<
      ApiFootballResponse<ApiFootballLeagueResponse[]>
    >('/leagues', {
      current: true,
    });

    return data.response ?? [];
  }

  // ============================================================
  // FIXTURES
  // ============================================================

  async getFixtures(
    leagueId: number,
    season: number,
  ): Promise<ApiFootballFixture[]> {
    this.validatePositiveNumber(leagueId, 'leagueId');
    this.validatePositiveNumber(season, 'season');

    const data = await this.request<ApiFootballResponse<ApiFootballFixture[]>>(
      '/fixtures',
      {
        league: leagueId,
        season,
      },
    );

    return data.response ?? [];
  }

  // ============================================================
  // STANDINGS
  // ============================================================

  async getStandings(
    leagueId: number,
    season: number,
  ): Promise<ApiFootballStandingResponse[]> {
    this.validatePositiveNumber(leagueId, 'leagueId');
    this.validatePositiveNumber(season, 'season');

    const data = await this.request<
      ApiFootballResponse<ApiFootballStandingResponse[]>
    >('/standings', {
      league: leagueId,
      season,
    });

    return data.response ?? [];
  }

  // ============================================================
  // TEAM STATISTICS
  // ============================================================

  async getTeamStatistics(
    leagueId: number,
    season: number,
    teamId: number,
  ): Promise<ApiFootballTeamStatisticsResponse | null> {
    this.validatePositiveNumber(leagueId, 'leagueId');
    this.validatePositiveNumber(season, 'season');
    this.validatePositiveNumber(teamId, 'teamId');

    const data = await this.request<
      ApiFootballResponse<ApiFootballTeamStatisticsResponse[]>
    >('/teams/statistics', {
      league: leagueId,
      season,
      team: teamId,
    });

    return data.response?.[0] ?? null;
  }

  // ============================================================
  // INJURIES / SIDELINED
  // ============================================================

  async getInjuries(
    leagueId: number,
    season: number,
  ): Promise<ApiFootballInjury[]> {
    this.validatePositiveNumber(leagueId, 'leagueId');
    this.validatePositiveNumber(season, 'season');

    const data = await this.request<ApiFootballResponse<ApiFootballInjury[]>>(
      '/injuries',
      {
        league: leagueId,
        season,
      },
    );

    return data.response ?? [];
  }

  // ============================================================
  // PREDICTIONS
  // ============================================================

  async getPrediction(
    fixtureId: number,
  ): Promise<ApiFootballPrediction | null> {
    this.validatePositiveNumber(fixtureId, 'fixtureId');

    const data = await this.request<
      ApiFootballResponse<ApiFootballPrediction[]>
    >('/predictions', {
      fixture: fixtureId,
    });

    return data.response?.[0] ?? null;
  }

  // ============================================================
  // REQUEST
  // ============================================================

  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | boolean>,
  ): Promise<T> {
    try {
      const response = await this.http.get<T>(endpoint, {
        params,
      });

      this.assertApiResponse(
        response.data as unknown as ApiFootballResponse<unknown>,
        endpoint,
      );

      return response.data;
    } catch (error) {
      this.logApiError(error, endpoint);

      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `API-Football request failed: ${endpoint}`,
      );
    }
  }

  // ============================================================
  // VALIDATION
  // ============================================================

  private validatePositiveNumber(value: number, field: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
  }

  // ============================================================
  // API RESPONSE VALIDATION
  // ============================================================

  private assertApiResponse(
    data: ApiFootballResponse<unknown>,
    endpoint: string,
  ): void {
    if (
      data.errors &&
      (Array.isArray(data.errors)
        ? data.errors.length > 0
        : Object.keys(data.errors).length > 0)
    ) {
      throw new InternalServerErrorException(
        `API-Football returned an error for ${endpoint}`,
      );
    }
  }

  // ============================================================
  // LOGGING
  // ============================================================

  private logApiError(error: unknown, endpoint: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      console.error('API-Football error', {
        endpoint,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });

      return;
    }

    console.error('API-Football error', {
      endpoint,
      error,
    });
  }
}
