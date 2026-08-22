// src/sports/interfaces/match.interface.ts

// ============================================================
// GOAL EVENT
// ============================================================

export interface GoalEvent {
  minute: number;

  injuryTime?: number | null;

  type?: string;

  team?: {
    id?: number;

    name?: string;
  };

  scorer?: {
    id?: number;

    name?: string;
  };

  assist?: {
    id?: number;

    name?: string;
  };

  score?: {
    home?: number;

    away?: number;
  };
}

// ============================================================
// MATCH
// ============================================================

export interface Match {
  id: string;

  leagueCode: string;

  league?: {
    code: string;

    name: string;

    country: string;

    emblem?: string;

    type?: string;
  };

  // ==========================================================
  // TEAMS
  // ==========================================================

  homeTeam: string;

  awayTeam: string;

  homeTeamId?: number;

  awayTeamId?: number;

  homeTeamBadge?: string;

  awayTeamBadge?: string;

  // ==========================================================
  // MATCH TIME / LOCATION
  // ==========================================================

  date: string;

  time?: string;

  venue?: string;

  // ==========================================================
  // STATUS
  // ==========================================================

  status?: string;

  matchday?: number;

  // ==========================================================
  // COMPETITION STAGE
  // ==========================================================

  stage?: string;

  group?: string | null;

  // ==========================================================
  // LIVE MATCH INFORMATION
  // ==========================================================

  minute?: number | null;

  injuryTime?: number | null;

  // ==========================================================
  // SCORE
  // ==========================================================

  homeScore?: number | null;

  awayScore?: number | null;

  // ==========================================================
  // GOAL EVENTS
  // ==========================================================

  goals: GoalEvent[];

  // ==========================================================
  // TIMESTAMP
  // ==========================================================

  kickoffTimestamp: number;
}
