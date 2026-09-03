import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import axios, { AxiosError, AxiosInstance } from 'axios';

import {
  OddsApiBookmakerMarkets,
  OddsApiEvent,
  OddsApiEventMarkets,
  OddsApiEventOdds,
  OddsApiScore,
  OddsApiSport,
} from './the-odds-api.interfaces';

@Injectable()
export class TheOddsApiService implements OnModuleInit {
  private readonly baseUrl = 'https://api.the-odds-api.com/v4';

  private apiKey!: string;

  private http!: AxiosInstance;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.configService.get<string>('THE_ODDS_API_KEY');

    if (!apiKey) {
      throw new Error('THE_ODDS_API_KEY is missing');
    }

    this.apiKey = apiKey;

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        Accept: 'application/json',
      },
    });
  }

  // ============================================================
  // SPORTS
  // ============================================================

  async getSports(): Promise<OddsApiSport[]> {
    return this.request<OddsApiSport[]>('/sports');
  }

  // ============================================================
  // EVENTS
  // ============================================================

  async getEvents(sport: string): Promise<OddsApiEvent[]> {
    this.requireSport(sport);

    return this.request<OddsApiEvent[]>(
      `/sports/${encodeURIComponent(sport)}/events`,
    );
  }

  // ============================================================
  // SCORES
  // ============================================================

  async getScores(
    sport: string,
    daysFrom?: 1 | 2 | 3,
  ): Promise<OddsApiScore[]> {
    this.requireSport(sport);

    if (daysFrom !== undefined && ![1, 2, 3].includes(daysFrom)) {
      throw new BadRequestException('daysFrom must be 1, 2, or 3');
    }

    return this.request<OddsApiScore[]>(
      `/sports/${encodeURIComponent(sport)}/scores`,
      daysFrom ? { daysFrom } : undefined,
    );
  }

  // ============================================================
  // ODDS
  // ============================================================

  async getOdds(
    sport: string,
    regions: string,
    markets?: string[],
  ): Promise<OddsApiEventOdds[]> {
    this.requireSport(sport);

    if (!regions?.trim()) {
      throw new BadRequestException('regions is required');
    }

    const params: Record<string, string | number | boolean> = {
      regions,
      oddsFormat: 'decimal',
    };

    if (markets && markets.length > 0) {
      params.markets = markets.join(',');
    }

    return this.request<OddsApiEventOdds[]>(
      `/sports/${encodeURIComponent(sport)}/odds`,
      params,
    );
  }

  // ============================================================
  // EVENT ODDS
  // ============================================================

  async getEventOdds(
    sport: string,
    eventId: string,
    regions: string,
    markets: string[],
  ): Promise<OddsApiEventOdds | null> {
    this.requireSport(sport);

    if (!eventId?.trim()) {
      throw new BadRequestException('eventId is required');
    }

    if (!regions?.trim()) {
      throw new BadRequestException('regions is required');
    }

    if (!Array.isArray(markets) || markets.length === 0) {
      throw new BadRequestException('At least one market is required');
    }

    const response = await this.request<OddsApiEventOdds[]>(
      `/sports/${encodeURIComponent(sport)}/events/${encodeURIComponent(
        eventId,
      )}/odds`,
      {
        regions,
        markets: markets.join(','),
        oddsFormat: 'decimal',
      },
    );

    return response[0] ?? null;
  }

  // ============================================================
  // AVAILABLE MARKETS
  // ============================================================

  async getEventMarkets(
    sport: string,
    eventId: string,
    regions: string,
  ): Promise<OddsApiBookmakerMarkets[]> {
    this.requireSport(sport);

    if (!eventId?.trim()) {
      throw new BadRequestException('eventId is required');
    }

    if (!regions?.trim()) {
      throw new BadRequestException('regions is required');
    }

    const response = await this.request<OddsApiEventMarkets>(
      `/sports/${encodeURIComponent(sport)}/events/${encodeURIComponent(
        eventId,
      )}/markets`,
      {
        regions,
      },
    );

    return response.bookmakers ?? [];
  }

  // ============================================================
  // REQUEST
  // ============================================================

  private async request<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<T> {
    try {
      const response = await this.http.get<T>(endpoint, {
        params: {
          ...params,
          apiKey: this.apiKey,
        },
      });

      return response.data;
    } catch (error) {
      this.logApiError(error, endpoint);

      throw new InternalServerErrorException(
        `The Odds API request failed: ${endpoint}`,
      );
    }
  }

  // ============================================================
  // VALIDATION
  // ============================================================

  private requireSport(sport: string): void {
    if (!sport?.trim()) {
      throw new BadRequestException('sport is required');
    }
  }

  // ============================================================
  // LOGGING
  // ============================================================

  private logApiError(error: unknown, endpoint: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      console.error('The Odds API error', {
        endpoint,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        remainingRequests:
          axiosError.response?.headers?.['x-requests-remaining'],
        usedRequests: axiosError.response?.headers?.['x-requests-used'],
        lastRequestCost: axiosError.response?.headers?.['x-requests-last'],
      });

      return;
    }

    console.error('The Odds API error', {
      endpoint,
      error,
    });
  }
}
