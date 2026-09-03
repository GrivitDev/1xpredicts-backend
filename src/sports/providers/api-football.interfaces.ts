/**
 * API-Football response contracts.
 *
 * These types intentionally represent API-Football data only.
 * They are not shared with TheSportsDB or The Odds API.
 */

export interface ApiFootballResponse<T> {
  get?: string;
  parameters?: Record<string, string | number | boolean | null>;
  errors?: Record<string, unknown> | string[];
  results?: number;
  paging?: {
    current?: number;
    total?: number;
  };
  response?: T;
}

export interface ApiFootballFixture {
  fixture: {
    id: number;
    referee?: string | null;
    timezone?: string | null;
    date?: string | null;
    timestamp?: number | null;

    periods?: {
      first?: number | null;
      second?: number | null;
    };

    venue?: {
      id?: number | null;
      name?: string | null;
      city?: string | null;
    };

    status?: {
      long?: string | null;
      short?: string | null;
      elapsed?: number | null;
      extra?: number | null;
    };
  };

  league: {
    id: number;
    name?: string | null;
    country?: string | null;
    logo?: string | null;
    flag?: string | null;
    season?: number | null;
    round?: string | null;
    standings?: boolean | null;
  };

  teams: {
    home: ApiFootballTeam;
    away: ApiFootballTeam;
  };

  goals?: {
    home?: number | null;
    away?: number | null;
  };

  score?: {
    halftime?: {
      home?: number | null;
      away?: number | null;
    };

    fulltime?: {
      home?: number | null;
      away?: number | null;
    };

    extratime?: {
      home?: number | null;
      away?: number | null;
    };

    penalty?: {
      home?: number | null;
      away?: number | null;
    };
  };

  events?: ApiFootballEvent[];

  lineups?: ApiFootballLineup[];

  statistics?: ApiFootballMatchStatistics[];

  players?: ApiFootballFixturePlayer[];
}

export interface ApiFootballTeam {
  id: number;
  name?: string | null;
  logo?: string | null;
  winner?: boolean | null;
}

export interface ApiFootballEvent {
  time?: {
    elapsed?: number | null;
    extra?: number | null;
  };

  team?: {
    id?: number | null;
    name?: string | null;
    logo?: string | null;
  };

  player?: {
    id?: number | null;
    name?: string | null;
  };

  assist?: {
    id?: number | null;
    name?: string | null;
  };

  type?: string | null;
  detail?: string | null;
  comments?: string | null;
}

export interface ApiFootballLineup {
  team?: {
    id?: number | null;
    name?: string | null;
    logo?: string | null;
    colors?: Record<string, unknown> | null;
  };

  coach?: {
    id?: number | null;
    name?: string | null;
    photo?: string | null;
  };

  formation?: string | null;

  startXI?: ApiFootballLineupPlayer[];

  substitutes?: ApiFootballLineupPlayer[];
}

export interface ApiFootballLineupPlayer {
  player?: {
    id?: number | null;
    name?: string | null;
    number?: number | null;
    pos?: string | null;
    grid?: string | null;
  };
}

export interface ApiFootballMatchStatistics {
  team?: {
    id?: number | null;
    name?: string | null;
    logo?: string | null;
  };

  statistics?: Array<{
    type?: string | null;
    value?: string | number | null;
  }>;
}

export interface ApiFootballFixturePlayer {
  team?: {
    id?: number | null;
    name?: string | null;
    logo?: string | null;
  };

  players?: Array<{
    player?: {
      id?: number | null;
      name?: string | null;
      photo?: string | null;
    };

    statistics?: Array<Record<string, unknown>>;
  }>;
}

export interface ApiFootballStandingResponse {
  league?: {
    id?: number;
    name?: string;
    country?: string;
    logo?: string;
    flag?: string;
    season?: number;

    standings?: ApiFootballStanding[][];
  };
}

export interface ApiFootballStanding {
  rank?: number;
  team?: {
    id?: number;
    name?: string;
    logo?: string;
  };

  points?: number;
  goalsDiff?: number;

  group?: string | null;
  form?: string | null;
  status?: string | null;
  description?: string | null;

  all?: ApiFootballStandingPerformance;
  home?: ApiFootballStandingPerformance;
  away?: ApiFootballStandingPerformance;
}

export interface ApiFootballStandingPerformance {
  played?: number;
  win?: number;
  draw?: number;
  lose?: number;

  goals?: {
    for?: number;
    against?: number;
  };
}

export interface ApiFootballTeamStatisticsResponse {
  league?: {
    id?: number;
    name?: string;
    country?: string;
    season?: number;
  };

  team?: ApiFootballTeam;

  fixtures?: {
    played?: ApiFootballHomeAwayTotal;
    wins?: ApiFootballHomeAwayTotal;
    draws?: ApiFootballHomeAwayTotal;
    losses?: ApiFootballHomeAwayTotal;
  };

  goals?: Record<string, unknown>;

  biggest?: Record<string, unknown>;

  clean_sheet?: Record<string, number>;

  failed_to_score?: Record<string, number>;

  penalty?: Record<string, unknown>;

  lineups?: Array<Record<string, unknown>>;

  cards?: Record<string, unknown>;

  form?: string | null;
}

export interface ApiFootballHomeAwayTotal {
  home?: number;
  away?: number;
  total?: number;
}

export interface ApiFootballInjury {
  player?: {
    id?: number;
    name?: string;
    photo?: string | null;
    type?: string | null;
    reason?: string | null;
  };

  team?: {
    id?: number;
    name?: string;
    logo?: string;
  };

  fixture?: {
    id?: number;
    timezone?: string;
    date?: string;
    timestamp?: number;
  };

  league?: {
    id?: number;
    name?: string;
    season?: number;
  };
}

export interface ApiFootballPrediction {
  predictions?: {
    winner?: {
      id?: number | null;
      name?: string | null;
      comment?: string | null;
    };

    win_or_draw?: boolean | null;
    under_over?: string | null;

    goals?: {
      home?: string | null;
      away?: string | null;
    };

    advice?: string | null;

    percent?: {
      home?: string | null;
      draw?: string | null;
      away?: string | null;
    };
  };

  league?: {
    id?: number;
    name?: string;
    country?: string;
    season?: number;
  };

  teams?: {
    home?: ApiFootballPredictionTeam;
    away?: ApiFootballPredictionTeam;
  };
}

export interface ApiFootballPredictionTeam {
  id?: number;
  name?: string;
  logo?: string;
  last_5?: Record<string, unknown>;
  league?: Record<string, unknown>;
}
