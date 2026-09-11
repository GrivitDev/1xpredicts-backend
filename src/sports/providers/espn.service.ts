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

  /**
   * Large page size reduces the number of ESPN requests
   * for large historical date ranges.
   */
  private readonly scoreboardPageSize = 1000;

  /**
   * Safety ceiling in case ESPN returns unexpected pagination.
   */
  private readonly scoreboardMaxPages = 100;

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
   */
  async getLeagues(): Promise<EspnLeague[]> {
    const leagues: EspnLeague[] = [];

    const firstPage = await this.getLeaguePage(1, 25);

    leagues.push(...this.extractCatalogueLeagues(firstPage));

    const pageCount = this.getPageCount(firstPage);

    const pageSize = this.getPageSize(firstPage, 25);

    for (let page = 2; page <= pageCount; page += 1) {
      const response = await this.getLeaguePage(page, pageSize);

      leagues.push(...this.extractCatalogueLeagues(response));
    }

    return this.deduplicateLeagues(leagues);
  }

  // ============================================================
  // 2. LEAGUE DETAIL
  // ============================================================

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
   * Gets all scoreboard events for the requested date range.
   *
   * If no dates are supplied, ESPN returns the current day.
   *
   * This method automatically:
   *
   * 1. Requests page 1.
   * 2. Reads ESPN pagination metadata when available.
   * 3. Requests every remaining page sequentially.
   * 4. Stops when no additional events are returned.
   * 5. Deduplicates events by event ID.
   */
  async getFixtures(
    league: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<EspnApiResponse> {
    this.validateLeague(league);

    this.validateDateRange(dateFrom, dateTo);

    const firstPage = await this.getFixturesPage(league, dateFrom, dateTo, 1);

    const allEvents: EspnEvent[] = [];

    const firstEvents = this.extractEvents(firstPage);

    allEvents.push(...firstEvents);

    const pageSize = this.getPageSize(firstPage, this.scoreboardPageSize);

    const explicitPageCount = this.getPageCount(firstPage);

    let pageCount = explicitPageCount;

    /*
     * If ESPN does not provide pageCount but the first page
     * is completely full, continue until a partial page appears.
     */
    if (pageCount <= 1 && firstEvents.length >= pageSize) {
      pageCount = this.scoreboardMaxPages;
    }

    const seenEventIds = new Set<string>();

    for (const event of firstEvents) {
      const eventId = this.toStringValue(event?.id);

      if (eventId) {
        seenEventIds.add(eventId);
      }
    }

    for (let page = 2; page <= pageCount; page += 1) {
      const response = await this.getFixturesPage(
        league,
        dateFrom,
        dateTo,
        page,
      );

      const events = this.extractEvents(response);

      if (!events.length) {
        break;
      }

      let newEvents = 0;

      for (const event of events) {
        const eventId = this.toStringValue(event?.id);

        if (eventId && seenEventIds.has(eventId)) {
          continue;
        }

        if (eventId) {
          seenEventIds.add(eventId);
        }

        allEvents.push(event);

        newEvents += 1;
      }

      /*
       * If ESPN ignored the page parameter or returned only
       * duplicates, stop instead of looping unnecessarily.
       */
      if (newEvents === 0) {
        break;
      }

      /*
       * When we are operating without explicit page metadata,
       * a partial page means the final page has been reached.
       */
      if (explicitPageCount <= 1 && events.length < pageSize) {
        break;
      }

      if (page >= this.scoreboardMaxPages) {
        this.logger.warn(
          `ESPN scoreboard pagination reached safety limit ` + `for ${league}`,
        );

        break;
      }
    }

    return {
      ...firstPage,

      events: allEvents,

      count: allEvents.length,

      pageIndex: 1,

      pageSize: allEvents.length > 0 ? allEvents.length : pageSize,

      pageCount: 1,
    };
  }

  /**
   * Requests exactly one scoreboard page.
   */
  private async getFixturesPage(
    league: string,
    dateFrom?: string,
    dateTo?: string,
    page = 1,
  ): Promise<EspnApiResponse> {
    const params: Record<string, string> = {
      page: String(page),
      limit: String(this.scoreboardPageSize),
    };

    this.applyDateRange(params, dateFrom, dateTo);

    return this.request<EspnApiResponse>(
      `${this.siteBaseUrl}/${encodeURIComponent(
        league.trim().toLowerCase(),
      )}/scoreboard`,
      params,
    );
  }

  // ============================================================
  // 4. LEAGUE RESULTS
  // ============================================================

  async getResults(
    league: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<EspnApiResponse> {
    return this.getFixtures(league, dateFrom, dateTo);
  }

  // ============================================================
  // 5. LEAGUE STANDINGS
  // ============================================================

  async getStandings(league: string): Promise<EspnStandingsResponse> {
    this.validateLeague(league);

    return this.request<EspnStandingsResponse>(
      `${this.standingsBaseUrl}/${encodeURIComponent(
        league.trim().toLowerCase(),
      )}/standings`,
    );
  }

  // ============================================================
  // 6. LEAGUE LEADERS
  // ============================================================

  async getLeaders(league: string): Promise<Record<string, unknown>> {
    this.validateLeague(league);

    return this.request<Record<string, unknown>>(
      `${this.coreBaseUrl}/leagues/${encodeURIComponent(
        league.trim().toLowerCase(),
      )}/leaders`,
    );
  }

  // ============================================================
  // 7. MATCH EVENT
  // ============================================================

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
  // 8. MATCH COMPETITION
  // ============================================================

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
  // 9. MATCH SUMMARY
  // ============================================================

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
  // 10. MATCH PLAYS / EVENTS
  // ============================================================

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
  // 11. MATCH STATISTICS
  // ============================================================

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
  // 12. MATCH ODDS
  // ============================================================

  async getMatchOdds(
    league: string,
    eventId: string,
    competitionId: string,
  ): Promise<EspnOdds[]> {
    this.validateLeague(league);

    this.validateId(eventId, 'eventId');

    this.validateId(competitionId, 'competitionId');

    const response = await this.request<
      | EspnOdds[]
      | {
          items?: EspnOdds[];
        }
    >(
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
  // 13. GLOBAL LIVE SCOREBOARD
  // ============================================================

  async getLiveMatches(): Promise<EspnApiResponse> {
    return this.request<EspnApiResponse>(`${this.siteBaseUrl}/all/scoreboard`);
  }

  // ============================================================
  // 14. GLOBAL SOCCER NEWS
  // ============================================================

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
  // SCOREBOARD EXTRACTION
  // ============================================================

  private extractEvents(response: EspnApiResponse): EspnEvent[] {
    if (Array.isArray(response.events)) {
      return response.events;
    }

    if (Array.isArray(response.items)) {
      return response.items as EspnEvent[];
    }

    return [];
  }

  private getPageCount(response: EspnApiResponse): number {
    const direct = this.toPositiveInteger(response.pageCount);

    if (direct) {
      return direct;
    }

    const pagination = (
      response as EspnApiResponse & {
        pagination?: Record<string, unknown>;
      }
    ).pagination;

    const nested = this.toPositiveInteger(pagination?.pageCount);

    return nested ?? 1;
  }

  private getPageSize(response: EspnApiResponse, fallback: number): number {
    const direct = this.toPositiveInteger(response.pageSize);

    if (direct) {
      return direct;
    }

    const pagination = (
      response as EspnApiResponse & {
        pagination?: Record<string, unknown>;
      }
    ).pagination;

    return this.toPositiveInteger(pagination?.pageSize) ?? fallback;
  }

  private toPositiveInteger(value: unknown): number | undefined {
    const result = typeof value === 'number' ? value : Number(value);

    if (!Number.isInteger(result) || result < 1) {
      return undefined;
    }

    return result;
  }

  private toStringValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const result = value.trim();

      return result || undefined;
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }

    return undefined;
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

  /**
   * ESPN expects scoreboard date ranges
   * in YYYYMMDD-YYYYMMDD format.
   */
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
