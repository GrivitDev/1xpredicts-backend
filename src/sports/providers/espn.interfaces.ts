// ============================================================
// ESPN API RESPONSE TYPES
// ============================================================

export interface EspnApiResponse {
  count?: number;
  pageIndex?: number;
  pageSize?: number;
  pageCount?: number;

  /**
   * ESPN reference-style collection responses.
   */
  items?: EspnReferenceItem[];

  /**
   * Some ESPN responses expose fully expanded leagues.
   */
  leagues?: EspnLeague[];

  /**
   * Scoreboard/event responses.
   */
  events?: EspnEvent[];

  season?: EspnSeason;
  day?: EspnDay;

  /**
   * Allows provider-specific fields without losing data.
   */
  [key: string]: unknown;
}

// ============================================================
// REFERENCES
// ============================================================

export interface EspnReferenceItem {
  $ref?: string;

  [key: string]: unknown;
}

// ============================================================
// LEAGUES
// ============================================================

export interface EspnLeague {
  id?: string;
  uid?: string;
  name?: string;
  abbreviation?: string;
  slug?: string;
  shortName?: string;
  displayName?: string;

  logos?: EspnLogo[];

  country?: string;

  type?: string;

  links?: EspnLink[];

  $ref?: string;

  [key: string]: unknown;
}

// ============================================================
// SEASON
// ============================================================

export interface EspnSeason {
  year?: number;
  displayName?: string;
  startDate?: string;
  endDate?: string;
  slug?: string;
  type?: EspnSeasonType;

  [key: string]: unknown;
}

// ============================================================
// SEASON TYPE
// ============================================================

export interface EspnSeasonType {
  id?: string;
  type?: string;
  name?: string;
  abbreviation?: string;
  startDate?: string;
  endDate?: string;
  slug?: string;

  [key: string]: unknown;
}

// ============================================================
// DAY
// ============================================================

export interface EspnDay {
  date?: string;
  number?: number;

  [key: string]: unknown;
}

// ============================================================
// LOGO
// ============================================================

export interface EspnLogo {
  href?: string;
  width?: number;
  height?: number;
  alt?: string;
  rel?: string[];
  lastUpdated?: string;

  [key: string]: unknown;
}

// ============================================================
// EVENTS
// ============================================================

export interface EspnEvent {
  id: string;
  uid?: string;

  date?: string;
  name?: string;
  shortName?: string;

  timeValid?: boolean;

  season?: EspnSeason;
  seasonType?: EspnSeasonType;

  competitions?: EspnCompetition[];

  links?: EspnLink[];

  league?: EspnLeague;

  [key: string]: unknown;
}

// ============================================================
// COMPETITIONS
// ============================================================

export interface EspnCompetition {
  id: string;

  uid?: string;

  date?: string;
  startDate?: string;

  attendance?: number;

  timeValid?: boolean;
  recent?: boolean;

  status?: EspnCompetitionStatus;

  venue?: EspnVenue;

  format?: EspnFormat;

  notes?: EspnNote[];

  broadcasts?: EspnBroadcast[];

  competitors?: EspnCompetitor[];

  details?: EspnEventDetail[];

  leaders?: EspnLeader[];

  odds?: EspnOdds[];

  links?: EspnLink[];

  [key: string]: unknown;
}

// ============================================================
// COMPETITION STATUS
// ============================================================

export interface EspnCompetitionStatus {
  clock?: number;
  displayClock?: string;
  period?: number;

  type?: EspnStatusType;

  [key: string]: unknown;
}

// ============================================================
// STATUS TYPE
// ============================================================

export interface EspnStatusType {
  id?: string;
  name?: string;
  state?: string;
  completed?: boolean;

  description?: string;
  detail?: string;
  shortDetail?: string;

  abbreviation?: string;

  [key: string]: unknown;
}

// ============================================================
// COMPETITOR
// ============================================================

export interface EspnCompetitor {
  id: string;
  uid?: string;

  type?: string;
  order?: number;

  homeAway?: 'home' | 'away';

  winner?: boolean;

  form?: string;

  score?: string;

  records?: EspnTeamRecord[];

  team?: EspnTeam;

  statistics?: EspnTeamMatchStatistic[];

  [key: string]: unknown;
}

// ============================================================
// TEAM
// ============================================================

export interface EspnTeam {
  id: string;

  uid?: string;

  slug?: string;

  abbreviation?: string;

  displayName?: string;

  shortDisplayName?: string;

  name?: string;

  nickname?: string;

  location?: string;

  color?: string;

  alternateColor?: string;

  logo?: string;

  logos?: EspnLogo[];

  isActive?: boolean;

  venue?: EspnTeamVenue;

  links?: EspnLink[];

  record?: EspnTeamRecord[];

  [key: string]: unknown;
}

// ============================================================
// TEAM VENUE
// ============================================================

export interface EspnTeamVenue {
  id?: string;

  fullName?: string;

  address?: {
    city?: string;
    state?: string;
    country?: string;
  };

  capacity?: number;

  indoor?: boolean;

  grass?: boolean;

  images?: EspnImage[];
}

// ============================================================
// TEAM RECORD
// ============================================================

export interface EspnTeamRecord {
  id?: string;

  name?: string;

  abbreviation?: string;

  type?: string;

  summary?: string;

  displayValue?: string;

  [key: string]: unknown;
}

// ============================================================
// TEAM MATCH STATISTICS
// ============================================================

export interface EspnTeamMatchStatistic {
  name?: string;

  displayName?: string;

  shortDisplayName?: string;

  description?: string;

  abbreviation?: string;

  value?: number;

  displayValue?: string;

  rank?: number;

  [key: string]: unknown;
}

// ============================================================
// MATCH DETAIL
// ============================================================

export interface EspnMatchDetail {
  id?: string;

  type?: string;

  text?: string;

  abbreviation?: string;

  clock?: EspnClock;

  team?: EspnTeam;

  athlete?: EspnAthlete;

  participants?: EspnAthlete[];

  scoreValue?: number;

  shootingPlayer?: EspnAthlete;

  assist?: EspnAthlete;

  [key: string]: unknown;
}

// ============================================================
// CLOCK
// ============================================================

export interface EspnClock {
  value?: number;

  displayValue?: string;

  [key: string]: unknown;
}

// ============================================================
// ATHLETE
// ============================================================

export interface EspnAthlete {
  id?: string;

  uid?: string;

  displayName?: string;

  shortName?: string;

  fullName?: string;

  jersey?: string;

  position?: {
    id?: string;
    name?: string;
    abbreviation?: string;
  };

  team?: EspnTeam;

  links?: EspnLink[];

  [key: string]: unknown;
}

// ============================================================
// VENUE
// ============================================================

export interface EspnVenue {
  id?: string;

  fullName?: string;

  shortName?: string;

  address?: {
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };

  capacity?: number;

  indoor?: boolean;

  grass?: boolean;

  images?: EspnImage[];

  [key: string]: unknown;
}

// ============================================================
// FORMAT
// ============================================================

export interface EspnFormat {
  regulation?: number;

  overtime?: boolean;

  periods?: number;

  clock?: number;

  [key: string]: unknown;
}

// ============================================================
// BROADCAST
// ============================================================

export interface EspnBroadcast {
  id?: string;

  market?: string;

  names?: string[];

  type?: {
    id?: string;
    shortName?: string;
  };

  media?: {
    shortName?: string;
  };

  [key: string]: unknown;
}

// ============================================================
// NOTE
// ============================================================

export interface EspnNote {
  headline?: string;

  type?: string;

  text?: string;

  [key: string]: unknown;
}

// ============================================================
// EVENT DETAIL
// ============================================================

export interface EspnEventDetail {
  id?: string;

  text?: string;

  type?: string;

  team?: EspnTeam;

  athlete?: EspnAthlete;

  clock?: EspnClock;

  scoringPlay?: boolean;

  redCard?: boolean;

  yellowCard?: boolean;

  penaltyKick?: boolean;

  ownGoal?: boolean;

  [key: string]: unknown;
}

// ============================================================
// LINKS
// ============================================================

export interface EspnLink {
  href?: string;

  text?: string;

  shortText?: string;

  rel?: string[];

  isExternal?: boolean;

  isPremium?: boolean;

  isAffiliate?: boolean;

  [key: string]: unknown;
}

// ============================================================
// IMAGES
// ============================================================

export interface EspnImage {
  href?: string;

  width?: number;

  height?: number;

  alt?: string;

  rel?: string[];

  source?: string;

  [key: string]: unknown;
}

// ============================================================
// STANDINGS
// ============================================================

export interface EspnStandingsResponse {
  name?: string;

  abbreviation?: string;

  season?: EspnSeason;

  seasonType?: EspnSeasonType;

  standings?: EspnStandingsGroup[];

  children?: EspnStandingsGroup[];

  [key: string]: unknown;
}

// ============================================================
// STANDINGS GROUP
// ============================================================

export interface EspnStandingsGroup {
  id?: string;

  uid?: string;

  name?: string;

  abbreviation?: string;

  standings?: EspnStandingEntry[];

  children?: EspnStandingsGroup[];

  [key: string]: unknown;
}

// ============================================================
// STANDING ENTRY
// ============================================================

export interface EspnStandingEntry {
  team?: EspnTeam;

  note?: {
    color?: string;
    description?: string;
    rank?: number;
  };

  stats?: EspnStandingStatistic[];

  statistics?: EspnStandingStatistic[];

  [key: string]: unknown;
}

// ============================================================
// STANDING STATISTIC
// ============================================================

export interface EspnStandingStatistic {
  name?: string;

  displayName?: string;

  shortDisplayName?: string;

  description?: string;

  abbreviation?: string;

  type?: string;

  value?: number;

  displayValue?: string;

  rank?: number;

  [key: string]: unknown;
}

// ============================================================
// ODDS
// ============================================================

export interface EspnOdds {
  provider?: EspnOddsProvider;

  details?: string;

  overUnder?: number;

  spread?: number;

  moneyline?: EspnMoneyline;

  homeTeamOdds?: EspnTeamOdds;

  awayTeamOdds?: EspnTeamOdds;

  [key: string]: unknown;
}

// ============================================================
// ODDS PROVIDER
// ============================================================

export interface EspnOddsProvider {
  id?: string;

  name?: string;

  priority?: number;

  logo?: string;

  [key: string]: unknown;
}

// ============================================================
// MONEYLINE
// ============================================================

export interface EspnMoneyline {
  home?: number;

  away?: number;

  draw?: number;

  [key: string]: unknown;
}

// ============================================================
// TEAM ODDS
// ============================================================

export interface EspnTeamOdds {
  team?: EspnTeam;

  favorite?: boolean;

  underdog?: boolean;

  moneyLine?: number;

  spread?: number;

  spreadOdds?: number;

  total?: number;

  totalOdds?: number;

  [key: string]: unknown;
}

// ============================================================
// LEADERS
// ============================================================

export interface EspnLeader {
  name?: string;

  displayName?: string;

  shortDisplayName?: string;

  abbreviation?: string;

  leaders?: EspnLeaderItem[];

  [key: string]: unknown;
}

// ============================================================
// LEADER ITEM
// ============================================================

export interface EspnLeaderItem {
  athlete?: EspnAthlete;

  team?: EspnTeam;

  value?: number;

  displayValue?: string;

  statistics?: EspnTeamMatchStatistic[];

  [key: string]: unknown;
}
