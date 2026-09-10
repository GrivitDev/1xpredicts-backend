import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import axios, { AxiosError, AxiosInstance } from 'axios';

import {
  EspnApiResponse,
  EspnCompetition,
  EspnEvent,
  EspnLeague,
  EspnOdds,
  EspnStandingsResponse,
} from './espn.interfaces';

import { SportsProviderRateLimitService } from '../services/sports-provider-rate-limit.service';

@Injectable()
export class EspnService {
  private readonly logger = new Logger(EspnService.name);

  private readonly siteBaseUrl =
    'https://site.api.espn.com/apis/site/v2/sports/soccer';

  private readonly standingsBaseUrl =
    'https://site.api.espn.com/apis/v2/sports/soccer';

  private readonly coreBaseUrl =
    'https://sports.core.api.espn.com/v2/sports/soccer';

  private readonly newsBaseUrl = 'https://now.core.api.espn.com/v1/sports';

  private readonly http: AxiosInstance;

  constructor(
    private readonly providerRateLimitService: SportsProviderRateLimitService,
  ) {
    this.http = axios.create({
      timeout: 15_000,
      headers: {
        Accept: 'application/json',
      },
    });
  }

  // ============================================================
  // 1. LEAGUE CATALOGUE
  // ============================================================

  /**
   * Gets one page from ESPN's complete soccer league catalogue.
   *
   * The catalogue is paginated.
   */
  async getLeaguePage(page = 1, limit = 25): Promise<EspnApiResponse> {
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('page must be a positive integer');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException(
        'limit must be an integer between 1 and 100',
      );
    }

    return this.request<EspnApiResponse>(`${this.coreBaseUrl}/leagues`, {
      page: String(page),
      limit: String(limit),
    });
  }

  /**
   * Gets the complete ESPN soccer league catalogue.
   *
   * We do not resolve each $ref individually here.
   * The catalogue itself is sufficient to discover the
   * ESPN league slugs.
   */
  async getLeagues(): Promise<EspnLeague[]> {
    const leagues: EspnLeague[] = [];

    const firstPage = await this.getLeaguePage(1, 25);

    leagues.push(...this.extractCatalogueLeagues(firstPage));

    const pageCount = firstPage.pageCount ?? 1;
    const pageSize = firstPage.pageSize ?? 25;

    for (let page = 2; page <= pageCount; page += 1) {
      const response = await this.getLeaguePage(page, pageSize);

      leagues.push(...this.extractCatalogueLeagues(response));
    }

    return this.deduplicateLeagues(leagues);
  }

  // ============================================================
  // 2. LEAGUE DETAIL
  // ============================================================

  /**
   * Gets detailed information for one ESPN league.
   *
   * Used during monthly discovery and when a new league
   * is discovered.
   */
  async getLeague(league: string): Promise<EspnLeague> {
    this.validateLeague(league);

    return this.request<EspnLeague>(
      `${this.coreBaseUrl}/leagues/${encodeURIComponent(
        league.trim().toLowerCase(),
      )}`,
    );
  }

  // ============================================================
  // 3. LEAGUE SCOREBOARD
  // ============================================================

  /**
   * Returns fixtures, live matches and completed events
   * for a league.
   *
   * Results are determined from the returned event/competition
   * status rather than by calling another results endpoint.
   */
  async getFixtures(
    league: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<EspnApiResponse> {
    this.validateLeague(league);
    this.validateDateRange(dateFrom, dateTo);

    const params: Record<string, string> = {};

    this.applyDateRange(params, dateFrom, dateTo);

    return this.request<EspnApiResponse>(
      `${this.siteBaseUrl}/${encodeURIComponent(
        league.trim().toLowerCase(),
      )}/scoreboard`,
      params,
    );
  }

  /**
   * Kept as a compatibility alias.
   *
   * ESPN uses the scoreboard for both scheduled and
   * completed matches.
   */
  async getResults(
    league: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<EspnApiResponse> {
    return this.getFixtures(league, dateFrom, dateTo);
  }

  // ============================================================
  // 4. LEAGUE STANDINGS
  // ============================================================

  /**
   * Gets current league standings.
   *
   * ESPN soccer standings use the /apis/v2/ endpoint.
   */
  async getStandings(league: string): Promise<EspnStandingsResponse> {
    this.validateLeague(league);

    return this.request<EspnStandingsResponse>(
      `${this.standingsBaseUrl}/${encodeURIComponent(
        league.trim().toLowerCase(),
      )}/standings`,
    );
  }

  // ============================================================
  // 5. LEAGUE LEADERS
  // ============================================================

  /**
   * Gets league statistical leaders.
   */
  async getLeaders(league: string): Promise<Record<string, unknown>> {
    this.validateLeague(league);

    return this.request<Record<string, unknown>>(
      `${this.coreBaseUrl}/leagues/${encodeURIComponent(
        league.trim().toLowerCase(),
      )}/leaders`,
    );
  }

  // ============================================================
  // 6. MATCH EVENT
  // ============================================================

  /**
   * Gets one ESPN event.
   */
  async getMatch(league: string, eventId: string): Promise<EspnEvent> {
    this.validateLeague(league);
    this.validateId(eventId, 'eventId');

    return this.request<EspnEvent>(
      `${this.coreBaseUrl}/leagues/${encodeURIComponent(
        league.trim().toLowerCase(),
      )}/events/${encodeURIComponent(eventId.trim())}`,
    );
  }

  // ============================================================
  // 7. MATCH COMPETITION
  // ============================================================

  /**
   * Gets the competition details attached to an event.
   */
  async getCompetition(
    league: string,
    eventId: string,
    competitionId: string,
  ): Promise<EspnCompetition> {
    this.validateLeague(league);
    this.validateId(eventId, 'eventId');
    this.validateId(competitionId, 'competitionId');

    return this.request<EspnCompetition>(
      `${this.coreBaseUrl}/leagues/${encodeURIComponent(
        league.trim().toLowerCase(),
      )}/events/${encodeURIComponent(
        eventId.trim(),
      )}/competitions/${encodeURIComponent(competitionId.trim())}`,
    );
  }

  // ============================================================
  // 8. MATCH SUMMARY
  // ============================================================

  /**
   * Gets ESPN's complete available match summary.
   *
   * The summary endpoint is event-based.
   */
  async getMatchSummary(
    league: string,
    eventId: string,
  ): Promise<Record<string, unknown>> {
    this.validateLeague(league);
    this.validateId(eventId, 'eventId');

    return this.request<Record<string, unknown>>(
      `${this.siteBaseUrl}/${encodeURIComponent(
        league.trim().toLowerCase(),
      )}/summary`,
      {
        event: eventId.trim(),
      },
    );
  }

  // ============================================================
  // 9. MATCH PLAYS / EVENTS
  // ============================================================

  /**
   * Gets match play-by-play events.
   */
  async getMatchEvents(
    league: string,
    eventId: string,
    competitionId: string,
  ): Promise<Record<string, unknown>> {
    this.validateLeague(league);
    this.validateId(eventId, 'eventId');
    this.validateId(competitionId, 'competitionId');

    return this.request<Record<string, unknown>>(
      `${this.coreBaseUrl}/leagues/${encodeURIComponent(
        league.trim().toLowerCase(),
      )}/events/${encodeURIComponent(
        eventId.trim(),
      )}/competitions/${encodeURIComponent(competitionId.trim())}/plays`,
      {
        limit: '300',
      },
    );
  }

  // ============================================================
  // 10. MATCH STATISTICS
  // ============================================================

  /**
   * Gets detailed statistics for one match competitor.
   */
  async getMatchStatistics(
    league: string,
    eventId: string,
    competitionId: string,
    competitorId: string,
  ): Promise<Record<string, unknown>> {
    this.validateLeague(league);

    this.validateId(eventId, 'eventId');

    this.validateId(competitionId, 'competitionId');

    this.validateId(competitorId, 'competitorId');

    return this.request<Record<string, unknown>>(
      `${this.coreBaseUrl}/leagues/${encodeURIComponent(
        league.trim().toLowerCase(),
      )}/events/${encodeURIComponent(
        eventId.trim(),
      )}/competitions/${encodeURIComponent(
        competitionId.trim(),
      )}/competitors/${encodeURIComponent(competitorId.trim())}/statistics`,
    );
  }

  // ============================================================
  // 11. MATCH ODDS
  // ============================================================

  /**
   * Gets ESPN's own match odds when available.
   *
   * This is separate from The Odds API.
   */
  async getMatchOdds(
    league: string,
    eventId: string,
    competitionId: string,
  ): Promise<EspnOdds[]> {
    this.validateLeague(league);

    this.validateId(eventId, 'eventId');

    this.validateId(competitionId, 'competitionId');

    const response = await this.request<EspnOdds[] | { items?: EspnOdds[] }>(
      `${this.coreBaseUrl}/leagues/${encodeURIComponent(
        league.trim().toLowerCase(),
      )}/events/${encodeURIComponent(
        eventId.trim(),
      )}/competitions/${encodeURIComponent(competitionId.trim())}/odds`,
    );

    if (Array.isArray(response)) {
      return response;
    }

    return Array.isArray(response.items) ? response.items : [];
  }

  // ============================================================
  // 12. GLOBAL LIVE SCOREBOARD
  // ============================================================

  /**
   * Gets the current global ESPN soccer scoreboard.
   *
   * Used for live-event discovery rather than querying every
   * league individually just to find currently live matches.
   */
  async getLiveMatches(): Promise<EspnApiResponse> {
    return this.request<EspnApiResponse>(`${this.siteBaseUrl}/all/scoreboard`);
  }

  // ============================================================
  // 13. GLOBAL SOCCER NEWS
  // ============================================================

  /**
   * Gets global soccer news.
   *
   * No league is supplied here intentionally.
   *
   * News runs through the separate 12-hour news scheduler.
   */
  async getNews(limit = 50): Promise<Record<string, unknown>> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException(
        'limit must be an integer between 1 and 100',
      );
    }

    return this.request<Record<string, unknown>>(`${this.newsBaseUrl}/news`, {
      sport: 'soccer',
      limit: String(limit),
    });
  }

  // ============================================================
  // REQUEST
  // ============================================================

  /**
   * Every ESPN HTTP request passes through the shared
   * persistent provider rate limiter.
   */
  private async request<T>(
    endpoint: string,
    params?: Record<string, string>,
  ): Promise<T> {
    return this.providerRateLimitService.execute('espn', async () => {
      try {
        const response = await this.http.get<T>(endpoint, {
          params,
        });

        this.assertResponse(response.data, endpoint);

        return response.data;
      } catch (error) {
        this.logApiError(error, endpoint);

        if (error instanceof InternalServerErrorException) {
          throw error;
        }

        throw new InternalServerErrorException('ESPN request failed');
      }
    });
  }

  // ============================================================
  // LEAGUE CATALOGUE EXTRACTION
  // ============================================================

  /**
   * Extracts league records from one catalogue page.
   *
   * ESPN catalogue pages can expose $ref entries instead
   * of full league objects. We extract the slug from the
   * reference and do not make another request here.
   */
  private extractCatalogueLeagues(response: EspnApiResponse): EspnLeague[] {
    const leagues: EspnLeague[] = [];

    if (Array.isArray(response.leagues)) {
      leagues.push(...response.leagues);
    }

    if (!Array.isArray(response.items)) {
      return leagues;
    }

    for (const item of response.items) {
      const reference = item.$ref?.trim();

      if (!reference) {
        continue;
      }

      const leagueSlug = this.extractLeagueSlug(reference);

      if (!leagueSlug) {
        continue;
      }

      leagues.push({
        id: leagueSlug,
        slug: leagueSlug,
        $ref: reference,
      });
    }

    return leagues;
  }

  /**
   * Extracts the ESPN league slug from a $ref URL.
   */
  private extractLeagueSlug(reference: string): string | null {
    try {
      const url = new URL(reference);

      const pathSegments = url.pathname.split('/').filter(Boolean);

      const leagueIndex = pathSegments.indexOf('leagues');

      if (leagueIndex < 0) {
        return null;
      }

      const slug = pathSegments[leagueIndex + 1];

      if (!slug) {
        return null;
      }

      return slug.trim().toLowerCase();
    } catch {
      return null;
    }
  }

  /**
   * Removes duplicate leagues by ESPN slug.
   */
  private deduplicateLeagues(leagues: EspnLeague[]): EspnLeague[] {
    const map = new Map<string, EspnLeague>();

    for (const league of leagues) {
      const slug =
        league.slug?.trim().toLowerCase() ?? league.id?.trim().toLowerCase();

      if (!slug) {
        continue;
      }

      const existing = map.get(slug);

      if (!existing) {
        map.set(slug, {
          ...league,
          id: league.id ?? slug,
          slug,
        });

        continue;
      }

      map.set(slug, {
        ...existing,
        ...league,
        id: league.id ?? existing.id ?? slug,
        slug,
      });
    }

    return [...map.values()];
  }

  // ============================================================
  // VALIDATION
  // ============================================================

  private validateLeague(league: string): void {
    if (!league || !league.trim()) {
      throw new BadRequestException('league is required');
    }
  }

  private validateId(value: string, field: string): void {
    if (!value || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
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

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    return date.toISOString().slice(0, 10) === value;
  }

  private applyDateRange(
    params: Record<string, string>,
    dateFrom?: string,
    dateTo?: string,
  ): void {
    if (!dateFrom && !dateTo) {
      return;
    }

    if (dateFrom && dateTo) {
      params.dates = `${dateFrom.replace(/-/g, '')}-${dateTo.replace(
        /-/g,
        '',
      )}`;

      return;
    }

    params.dates = (dateFrom ?? dateTo)!.replace(/-/g, '');
  }

  // ============================================================
  // RESPONSE VALIDATION
  // ============================================================

  private assertResponse(data: unknown, endpoint: string): void {
    if (data === undefined || data === null) {
      throw new InternalServerErrorException(
        `ESPN returned an empty response for ${endpoint}`,
      );
    }
  }

  // ============================================================
  // ERROR LOGGING
  // ============================================================

  private logApiError(error: unknown, endpoint: string): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      this.logger.error(`ESPN request failed: ${endpoint}`, {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });

      return;
    }

    this.logger.error(`ESPN request failed: ${endpoint}`, error);
  }
}
