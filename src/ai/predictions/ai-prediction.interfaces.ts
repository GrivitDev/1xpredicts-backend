// src/ai/predictions/ai-prediction.interfaces.ts

import { PredictionMarket } from '../../predictions/constants/prediction-markets';

// ============================================================
// ACCESS
// ============================================================

export type AiPredictionAccessType = 'free' | 'regular' | 'vip';

// ============================================================
// SOURCES
// ============================================================

export interface AiResearchSource {
  title: string;

  url: string;
}

// ============================================================
// RESEARCH FINDING
// ============================================================

export interface AiResearchFinding {
  topic: string;

  finding: string;

  sources: AiResearchSource[];
}

// ============================================================
// LEAGUE RESEARCH
// ============================================================

export interface AiLeagueResearchItem {
  title: string;

  url: string;

  content?: string;

  publishedDate?: string;

  score?: number;
}

export interface AiLeagueResearch {
  leagueCode: string;

  leagueName: string;

  country: string;

  cacheDate: string;

  searchedAt: Date;

  expiresAt: Date;

  results: AiLeagueResearchItem[];

  images: string[];
}

// ============================================================
// TEAM
// ============================================================

export interface AiTeamSnapshot {
  name: string;

  position?: number;

  points?: number;

  playedGames?: number;

  won?: number;

  draw?: number;

  lost?: number;

  goalsFor?: number;

  goalsAgainst?: number;

  goalDifference?: number;

  form?: string | null;
}

// ============================================================
// RECENT MATCH
// ============================================================

export interface AiRecentMatch {
  matchId: string;

  homeTeam: string;

  awayTeam: string;

  homeScore: number | null;

  awayScore: number | null;

  date: string;

  status?: string;
}

// ============================================================
// MATCH INPUT
// ============================================================

export interface AiPredictionMatchInput {
  matchId: string;

  leagueCode: string;

  leagueName?: string;

  country?: string;

  homeTeam: string;

  awayTeam: string;

  matchDate: string;

  kickoffTimestamp: number;

  venue?: string;

  stage?: string;

  homeTeamData?: AiTeamSnapshot;

  awayTeamData?: AiTeamSnapshot;

  homeRecentMatches?: AiRecentMatch[];

  awayRecentMatches?: AiRecentMatch[];

  headToHead?: AiRecentMatch[];

  leagueResearch?: AiLeagueResearch;

  additionalNews?: string[];

  additionalContext?: string;
}

// ============================================================
// MARKET
// ============================================================

export interface AiPredictionMarket {
  market: PredictionMarket;

  selection: string;

  confidence: number;

  reasoning: string;

  supportingSources: AiResearchSource[];

  playerId?: string;

  playerName?: string;
}

// ============================================================
// RESULT
// ============================================================

export interface AiPredictionResult {
  matchId: string;

  homeTeam: string;

  awayTeam: string;

  prediction: 'HOME' | 'DRAW' | 'AWAY';

  probabilities: {
    home: number;

    draw: number;

    away: number;
  };

  confidence: number;

  markets: AiPredictionMarket[];

  accessType: AiPredictionAccessType;

  accessReason: string;

  reasoning: string[];

  keyFactors: string[];

  risks: string[];

  recommendation?: string;

  research: AiResearchFinding[];

  sources: AiResearchSource[];
}

// ============================================================
// REQUEST
// ============================================================

export interface AiPredictionRequest {
  match: AiPredictionMatchInput;

  requestedMarkets?: PredictionMarket[];

  includeReasoning?: boolean;
}
