export interface FootballDataArea {
  id: number;

  name: string;

  code: string | null;

  flag: string | null;
}

export interface FootballDataSeason {
  id: number;

  startDate: string;

  endDate: string;

  currentMatchday: number | null;

  winner: FootballDataTeam | null;

  stages?: string[];
}

export interface FootballDataCompetition {
  id: number;

  name: string;

  code: string | null;

  type: 'LEAGUE' | 'CUP' | string;

  emblem: string | null;

  plan?: string;

  area: FootballDataArea;

  currentSeason: FootballDataSeason | null;

  seasons: FootballDataSeason[];

  numberOfAvailableSeasons?: number;

  lastUpdated?: string;
}

export interface FootballDataCompetitionListResponse {
  count: number;

  filters?: Record<string, unknown>;

  competitions: FootballDataCompetition[];
}

export interface FootballDataTeam {
  id: number;

  name: string;

  shortName: string | null;

  tla: string | null;

  crest: string | null;

  address?: string | null;

  website?: string | null;

  founded?: number | null;

  clubColors?: string | null;

  venue?: string | null;

  runningCompetitions?: Array<{
    id: number;

    name: string;

    code: string | null;

    type: string;

    emblem: string | null;
  }>;

  coach?: FootballDataCoach | null;

  squad?: FootballDataSquadMember[];

  staff?: FootballDataStaffMember[];

  lastUpdated?: string;
}

export interface FootballDataCoach {
  id: number | null;

  firstName: string | null;

  lastName: string | null;

  name: string | null;

  dateOfBirth: string | null;

  nationality: string | null;

  contract?: {
    start: string | null;

    until: string | null;
  } | null;
}

export interface FootballDataSquadMember {
  id: number;

  name: string;

  firstName: string | null;

  lastName: string | null;

  dateOfBirth: string | null;

  nationality: string | null;

  position: string | null;

  shirtNumber: number | null;

  lastUpdated?: string;
}

export interface FootballDataStaffMember extends FootballDataSquadMember {
  role?: string | null;
}

export interface FootballDataPlayer {
  id: number;

  name: string;

  firstName: string | null;

  lastName: string | null;

  dateOfBirth?: string | null;

  nationality?: string | null;

  position?: string | null;

  shirtNumber?: number | null;

  lastUpdated?: string;
}

export interface FootballDataReferee {
  id: number;

  name: string;

  type: string | null;

  nationality: string | null;
}

export interface FootballDataMatchScore {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;

  duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT' | string;

  fullTime: {
    home: number | null;

    away: number | null;
  };

  halfTime: {
    home: number | null;

    away: number | null;
  };

  extraTime: {
    home: number | null;

    away: number | null;
  };

  penalties: {
    home: number | null;

    away: number | null;
  };
}

export interface FootballDataGoal {
  minute: number;

  injuryTime: number | null;

  type: string | null;

  team: FootballDataTeam;

  scorer?: FootballDataPlayer | null;

  assist?: FootballDataPlayer | null;

  score?: {
    home: number | null;

    away: number | null;
  } | null;
}

export interface FootballDataMatch {
  area: FootballDataArea;

  competition: {
    id: number;

    name: string;

    code: string | null;

    type: string;

    emblem: string | null;
  };

  season: FootballDataSeason;

  id: number;

  utcDate: string;

  status:
    | 'SCHEDULED'
    | 'TIMED'
    | 'IN_PLAY'
    | 'PAUSED'
    | 'FINISHED'
    | 'POSTPONED'
    | 'SUSPENDED'
    | 'CANCELLED'
    | string;

  minute: number | null;

  injuryTime: number | null;

  attendance: number | null;

  venue: string | null;

  matchday: number | null;

  stage: string | null;

  group: string | null;

  lastUpdated: string;

  homeTeam: FootballDataTeam;

  awayTeam: FootballDataTeam;

  score: FootballDataMatchScore;

  goals?: FootballDataGoal[];

  penalties?: FootballDataGoal[];

  bookings?: unknown[];

  substitutions?: unknown[];

  odds?: Record<string, unknown> | null;

  referees?: FootballDataReferee[];
}

export interface FootballDataMatchListResponse {
  filters: Record<string, unknown>;

  resultSet: {
    count: number;

    first: string | null;

    last: string | null;

    played: number;

    wins?: number;

    draws?: number;

    losses?: number;

    competitions?: string;
  };

  competition: FootballDataCompetition;

  matches: FootballDataMatch[];
}

export interface FootballDataTeamListResponse {
  count: number;

  filters: Record<string, unknown>;

  competition: FootballDataCompetition;

  season: FootballDataSeason;

  teams: FootballDataTeam[];
}

export interface FootballDataStandingTeam {
  position: number;

  team: FootballDataTeam;

  playedGames: number;

  form: string | null;

  won: number;

  draw: number;

  lost: number;

  points: number;

  goalsFor: number;

  goalsAgainst: number;

  goalDifference: number;
}

export interface FootballDataStanding {
  stage: string;

  type: 'TOTAL' | 'HOME' | 'AWAY' | string;

  group: string | null;

  table: FootballDataStandingTeam[];
}

export interface FootballDataStandingsResponse {
  filters: Record<string, unknown>;

  area: FootballDataArea;

  competition: {
    id: number;

    name: string;

    code: string | null;

    type: string;

    emblem: string | null;
  };

  season: FootballDataSeason;

  standings: FootballDataStanding[];
}
