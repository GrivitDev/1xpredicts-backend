import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import axios, { AxiosError, AxiosInstance } from 'axios';

import {
  ApiFootballFixture,
  ApiFootballLeagueResponse,
  ApiFootballResponse,
  ApiFootballStandingResponse,
} from './api-football.interfaces';

import { SportsProviderRateLimitService } from '../services/sports-provider-rate-limit.service';

@Injectable()
export class ApiFootballService implements OnModuleInit {
  private readonly logger = new Logger(ApiFootballService.name);

  private readonly baseUrl = 'https://v3.football.api-sports.io';

  private http!: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,

    private readonly providerRateLimitService: SportsProviderRateLimitService,
  ) {}

  onModuleInit(): void {
    const apiKey = this.configService.get<string>('API_FOOTBALL_KEY')?.trim();

    if (!apiKey) {
      throw new Error('API_FOOTBALL_KEY is missing');
    }

    this.http = axios.create({
      baseURL: this.baseUrl,

      timeout: 15_000,

      headers: {
        'x-apisports-key': apiKey,
        Accept: 'application/json',
      },
    });
  }

  // ============================================================
  // LEAGUES
  // ============================================================

  async getCurrentLeagues(): Promise<
    ApiFootballResponse<ApiFootballLeagueResponse[]>
  > {
    return this.request<ApiFootballResponse<ApiFootballLeagueResponse[]>>(
      '/leagues',
      {
        current: true,
      },
    );
  }

  // ============================================================
  // FIXTURES
  // ============================================================

  async getFixtures(
    leagueId: number,
    season: number,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<ApiFootballResponse<ApiFootballFixture[]>> {
    this.validatePositiveNumber(leagueId, 'leagueId');

    this.validatePositiveNumber(season, 'season');

    this.validateDateRange(dateFrom, dateTo);

    const params: Record<string, string | number | boolean> = {
      league: leagueId,
      season,
    };

    if (dateFrom) {
      params.from = dateFrom;
    }

    if (dateTo) {
      params.to = dateTo;
    }

    return this.request<ApiFootballResponse<ApiFootballFixture[]>>(
      '/fixtures',
      params,
    );
  }

  // ============================================================
  // STANDINGS
  // ============================================================

  async getStandings(
    leagueId: number,
    season: number,
  ): Promise<ApiFootballResponse<ApiFootballStandingResponse[]>> {
    this.validatePositiveNumber(leagueId, 'leagueId');

    this.validatePositiveNumber(season, 'season');

    return this.request<ApiFootballResponse<ApiFootballStandingResponse[]>>(
      '/standings',
      {
        league: leagueId,
        season,
      },
    );
  }

  // ============================================================
  // REQUEST
  // ============================================================

  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | boolean>,
  ): Promise<T> {
    return this.providerRateLimitService.execute('api-football', async () => {
      try {
        const response = await this.http.get<T>(endpoint, {
          params,
        });

        const data = response.data as unknown as ApiFootballResponse<unknown>;

        this.assertApiResponse(data, endpoint);

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
    });
  }

  // ============================================================
  // VALIDATION
  // ============================================================

  private validatePositiveNumber(value: number, field: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
  }

  private validateDateRange(dateFrom?: string, dateTo?: string): void {
    if (dateFrom !== undefined && !this.isValidDate(dateFrom)) {
      throw new BadRequestException('dateFrom must be a valid YYYY-MM-DD date');
    }

    if (dateTo !== undefined && !this.isValidDate(dateTo)) {
      throw new BadRequestException('dateTo must be a valid YYYY-MM-DD date');
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException('dateFrom cannot be after dateTo');
    }
  }

  private isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime());
  }

  // ============================================================
  // RESPONSE VALIDATION
  // ============================================================

  private assertApiResponse(
    data: ApiFootballResponse<unknown>,
    endpoint: string,
  ): void {
    if (!data) {
      throw new InternalServerErrorException(
        `API-Football returned an empty response for ${endpoint}`,
      );
    }

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
  // ERROR LOGGING
  // ============================================================

  private logApiError(error: unknown, endpoint: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      this.logger.error(`API-Football request failed: ${endpoint}`, {
        status: axiosError.response?.status,

        data: axiosError.response?.data,
      });

      return;
    }

    this.logger.error(`API-Football request failed: ${endpoint}`, error);
  }

  // ============================================================
  // LEAGUES
  // ============================================================

  async getLeagues(): Promise<
    ApiFootballResponse<ApiFootballLeagueResponse[]>
  > {
    return this.request<ApiFootballResponse<ApiFootballLeagueResponse[]>>(
      '/leagues',
      {},
    );
  }
}
