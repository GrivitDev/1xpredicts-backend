/**
 * The Odds API V4 response contracts.
 *
 * These types intentionally represent odds-provider data only.
 */

export interface OddsApiSport {
  key: string;
  group: string;
  title: string;
  description?: string;
  active: boolean;
  has_outrights: boolean;
  ends?: string;
  image?: string;
}

export interface OddsApiEvent {
  id: string;

  sport_key: string;
  sport_title: string;

  commence_time: string;

  home_team: string;
  away_team: string;
}

export interface OddsApiScore {
  id: string;

  sport_key: string;
  sport_title: string;

  commence_time: string;

  completed: boolean;

  home_team: string;
  away_team: string;

  scores?: OddsApiScoreEntry[];

  last_update?: string | null;
}

export interface OddsApiScoreEntry {
  name: string;
  score: string;
}

export interface OddsApiEventOdds {
  id: string;

  sport_key: string;
  sport_title: string;

  commence_time: string;

  home_team: string;
  away_team: string;

  bookmakers: OddsApiBookmaker[];
}

export interface OddsApiBookmaker {
  key: string;
  title: string;

  last_update: string;

  markets: OddsApiMarket[];
}

export interface OddsApiMarket {
  key: string;

  last_update: string;

  outcomes: OddsApiOutcome[];
}

export interface OddsApiOutcome {
  name: string;

  price: number;

  point?: number;

  description?: string;
}

export interface OddsApiEventMarkets {
  id: string;

  bookmakers: OddsApiBookmakerMarkets[];
}

export interface OddsApiBookmakerMarkets {
  key: string;

  title: string;

  markets: Array<{
    key: string;
  }>;
}
