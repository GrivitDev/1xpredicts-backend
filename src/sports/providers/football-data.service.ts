import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

import {
  FootballDataCompetition,
  FootballDataMatch,
  FootballDataMatchListResponse,
  FootballDataStandingsResponse,
  FootballDataTeamListResponse,
} from './football-data.interfaces';

export interface FootballDataMatchQuery {
  dateFrom?: string;
  dateTo?: string;
  season?: number;
  status?: string;
  stage?: string;
  group?: string;
  matchday?: number;
  limit?: number;
}

@Injectable()
export class FootballDataService implements OnModuleInit {
  private readonly logger = new Logger(FootballDataService.name);

  private readonly baseUrl = 'https://api.football-data.org/v4';

  private readonly apiKey = process.env.FOOTBALL_DATA_API_KEY?.trim();

  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 15_000,
      headers: {
        Accept: 'application/json',
        'X-Unfold-Goals': 'true',
        ...(this.apiKey
          ? {
              'X-Auth-Token': this.apiKey,
            }
          : {}),
      },
    });
  }

  onModuleInit(): void {
    if (!this.apiKey) {
      this.logger.warn('FOOTBALL_DATA_API_KEY is not configured');

      return;
    }

    this.logger.log('Football-Data.org provider initialized');
  }

  /**
   * Get competition information and season catalogue.
   */
  async getCompetition(code: string): Promise<FootballDataCompetition> {
    return this.request<FootballDataCompetition>(
      `/competitions/${this.normalizeCompetitionCode(code)}`,
    );
  }

  /**
   * Get all matches available for a competition.
   *
   * This is the raw Football-Data.org dataset.
   */
  async getMatches(
    code: string,
    query: FootballDataMatchQuery = {},
  ): Promise<FootballDataMatchListResponse> {
    return this.request<FootballDataMatchListResponse>(
      `/competitions/${this.normalizeCompetitionCode(code)}/matches`,
      {
        params: this.cleanQuery(query),
      },
    );
  }

  /**
   * Get scheduled/upcoming matches.
   */
  async getScheduledMatches(
    code: string,
    query: Omit<FootballDataMatchQuery, 'status'> = {},
  ): Promise<FootballDataMatchListResponse> {
    return this.getMatches(code, {
      ...query,
      status: 'SCHEDULED,TIMED',
    });
  }

  /**
   * Get completed matches/results.
   */
  async getFinishedMatches(
    code: string,
    query: Omit<FootballDataMatchQuery, 'status'> = {},
  ): Promise<FootballDataMatchListResponse> {
    return this.getMatches(code, {
      ...query,
      status: 'FINISHED',
    });
  }

  /**
   * Get one match directly by Football-Data.org match ID.
   */
  async getMatch(matchId: number): Promise<FootballDataMatch> {
    this.assertPositiveInteger(matchId, 'matchId');

    return this.request<FootballDataMatch>(`/matches/${matchId}`);
  }

  /**
   * Get teams participating in a competition season.
   */
  async getTeams(
    code: string,
    season?: number,
  ): Promise<FootballDataTeamListResponse> {
    return this.request<FootballDataTeamListResponse>(
      `/competitions/${this.normalizeCompetitionCode(code)}/teams`,
      {
        params:
          season === undefined
            ? undefined
            : {
                season,
              },
      },
    );
  }

  /**
   * Get the current competition standings.
   */
  async getStandings(
    code: string,
    season?: number,
  ): Promise<FootballDataStandingsResponse> {
    return this.request<FootballDataStandingsResponse>(
      `/competitions/${this.normalizeCompetitionCode(code)}/standings`,
      {
        params:
          season === undefined
            ? undefined
            : {
                season,
              },
      },
    );
  }

  private async request<T>(
    path: string,
    config: AxiosRequestConfig = {},
  ): Promise<T> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'Football-Data.org API key is not configured',
      );
    }

    try {
      const response = await this.client.get<T>(path, config);

      return response.data;
    } catch (error) {
      this.handleRequestError(error, path);
    }
  }

  private cleanQuery(
    query: FootballDataMatchQuery,
  ): Record<string, string | number> {
    const params: Record<string, string | number> = {};

    if (query.dateFrom) {
      params.dateFrom = query.dateFrom;
    }

    if (query.dateTo) {
      params.dateTo = query.dateTo;
    }

    if (query.season !== undefined) {
      params.season = query.season;
    }

    if (query.status) {
      params.status = query.status;
    }

    if (query.stage) {
      params.stage = query.stage;
    }

    if (query.group) {
      params.group = query.group;
    }

    if (query.matchday !== undefined) {
      params.matchday = query.matchday;
    }

    if (query.limit !== undefined) {
      params.limit = query.limit;
    }

    return params;
  }

  private normalizeCompetitionCode(code: string): string {
    const normalized = code.trim().toUpperCase();

    if (!normalized) {
      throw new Error('Football-Data competition code is required');
    }

    return encodeURIComponent(normalized);
  }

  private assertPositiveInteger(value: number, field: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${field} must be a positive integer`);
    }
  }

  private handleRequestError(error: unknown, path: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string }>;

      const status = axiosError.response?.status;

      const message =
        axiosError.response?.data?.message ??
        axiosError.message ??
        'Unknown Football-Data.org error';

      this.logger.error(
        `Football-Data request failed: ${path} ` +
          `(${status ?? 'network'}) - ${message}`,
      );

      throw new ServiceUnavailableException(
        `Football-Data.org request failed${
          status ? ` with status ${status}` : ''
        }`,
      );
    }

    this.logger.error(`Football-Data request failed: ${path}`);

    throw new ServiceUnavailableException('Football-Data.org request failed');
  }
}
