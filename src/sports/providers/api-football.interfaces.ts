export interface ApiFootballResponse<T> {
  get?: string;

  parameters?: Record<string, string | number | boolean | null | undefined>;

  errors?: Record<string, unknown> | string[];

  results?: number;

  paging?: {
    current?: number;
    total?: number;
  };

  response?: T;
}

// ============================================================
// LEAGUES
// ============================================================

export interface ApiFootballLeagueResponse {
  league?: {
    id?: number;

    name?: string;

    type?: string;

    logo?: string;
  };

  country?: {
    name?: string;

    code?: string;

    flag?: string;
  };

  seasons?: ApiFootballLeagueSeason[];
}

export interface ApiFootballLeagueSeason {
  year?: number;

  start?: string | null;

  end?: string | null;

  current?: boolean;
}

// ============================================================
// FIXTURES
// ============================================================

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
}

export interface ApiFootballTeam {
  id: number;

  name?: string | null;

  logo?: string | null;

  winner?: boolean | null;
}

// ============================================================
// STANDINGS
// ============================================================

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
