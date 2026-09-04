export const SPORTS_CACHE_PREFIX = '2xpredict:sports';

export const SPORTS_CACHE_TTL = {
  // ============================================================
  // GENERAL
  // ============================================================

  LIVE: 30,

  FIXTURES: 6 * 60 * 60,

  RESULTS: 24 * 60 * 60,

  STANDINGS: 6 * 60 * 60,

  COMPETITIONS: 24 * 60 * 60,

  TEAMS: 24 * 60 * 60,

  ACTIVE_COMPETITIONS: 24 * 60 * 60,

  // ============================================================
  // API-FOOTBALL
  // ============================================================

  API_FOOTBALL_FIXTURES: 6 * 60 * 60,

  API_FOOTBALL_STANDINGS: 6 * 60 * 60,

  API_FOOTBALL_TEAM_STATISTICS: 12 * 60 * 60,

  API_FOOTBALL_INJURIES: 6 * 60 * 60,

  API_FOOTBALL_PREDICTION: 6 * 60 * 60,

  // ============================================================
  // THE SPORTS DB
  // ============================================================

  THESPORTSDB_SEASON: 24 * 60 * 60,

  THESPORTSDB_EVENTS: 6 * 60 * 60,

  THESPORTSDB_EVENT: 12 * 60 * 60,

  THESPORTSDB_TIMELINE: 30,

  THESPORTSDB_LINEUP: 60 * 60,

  THESPORTSDB_STATISTICS: 5 * 60,

  THESPORTSDB_TEAMS: 24 * 60 * 60,

  THESPORTSDB_PLAYERS: 24 * 60 * 60,

  THESPORTSDB_PLAYER_STATISTICS: 12 * 60 * 60,

  THESPORTSDB_VENUE: 7 * 24 * 60 * 60,

  // ============================================================
  // ODDS API
  // ============================================================

  ODDS_SPORTS: 24 * 60 * 60,

  ODDS_EVENTS: 6 * 60 * 60,

  ODDS_SCORES: 5 * 60,

  ODDS: 2 * 60,

  // ============================================================
  // YOUTUBE
  // ============================================================

  YOUTUBE: 24 * 60 * 60,
} as const;

export const SPORTS_CACHE_KEYS = {
  // ============================================================
  // GENERAL
  // ============================================================

  live: () => `${SPORTS_CACHE_PREFIX}:live`,

  competitions: () => `${SPORTS_CACHE_PREFIX}:competitions`,

  activeCompetitions: () => `${SPORTS_CACHE_PREFIX}:active-competitions`,

  fixtures: (competitionId: string) =>
    `${SPORTS_CACHE_PREFIX}:fixtures:${competitionId}`,

  results: (competitionId: string) =>
    `${SPORTS_CACHE_PREFIX}:results:${competitionId}`,

  standings: (competitionId: string) =>
    `${SPORTS_CACHE_PREFIX}:standings:${competitionId}`,

  teams: (competitionId: string) =>
    `${SPORTS_CACHE_PREFIX}:teams:${competitionId}`,

  // ============================================================
  // API-FOOTBALL
  // ============================================================

  apiFootballFixtures: (leagueId: number, season: number) =>
    `${SPORTS_CACHE_PREFIX}:api-football:fixtures:${leagueId}:${season}`,

  apiFootballStandings: (leagueId: number, season: number) =>
    `${SPORTS_CACHE_PREFIX}:api-football:standings:${leagueId}:${season}`,

  apiFootballTeamStatistics: (
    leagueId: number,
    season: number,
    teamId: number,
  ) =>
    `${SPORTS_CACHE_PREFIX}:api-football:team-statistics:${leagueId}:${season}:${teamId}`,

  apiFootballInjuries: (leagueId: number, season: number) =>
    `${SPORTS_CACHE_PREFIX}:api-football:injuries:${leagueId}:${season}`,

  apiFootballPrediction: (fixtureId: number) =>
    `${SPORTS_CACHE_PREFIX}:api-football:prediction:${fixtureId}`,

  // ============================================================
  // THE SPORTS DB
  // ============================================================

  theSportsDbEvent: (eventId: number) =>
    `${SPORTS_CACHE_PREFIX}:thesportsdb:event:${eventId}`,

  theSportsDbEvents: (leagueId: number) =>
    `${SPORTS_CACHE_PREFIX}:thesportsdb:events:${leagueId}`,

  theSportsDbTimeline: (eventId: number) =>
    `${SPORTS_CACHE_PREFIX}:thesportsdb:timeline:${eventId}`,

  theSportsDbLineup: (eventId: number) =>
    `${SPORTS_CACHE_PREFIX}:thesportsdb:lineup:${eventId}`,

  theSportsDbStatistics: (eventId: number) =>
    `${SPORTS_CACHE_PREFIX}:thesportsdb:statistics:${eventId}`,

  theSportsDbTeams: (leagueId: number) =>
    `${SPORTS_CACHE_PREFIX}:thesportsdb:teams:${leagueId}`,

  theSportsDbPlayers: (teamId: number) =>
    `${SPORTS_CACHE_PREFIX}:thesportsdb:players:${teamId}`,

  theSportsDbPlayerStatistics: (playerId: number, teamId: number) =>
    `${SPORTS_CACHE_PREFIX}:thesportsdb:player-statistics:${playerId}:${teamId}`,

  theSportsDbVenue: (venueId: number) =>
    `${SPORTS_CACHE_PREFIX}:thesportsdb:venue:${venueId}`,

  theSportsDbSeason: (leagueId: number, season: string) =>
    `${SPORTS_CACHE_PREFIX}:thesportsdb:season:${leagueId}:${season}`,

  // ============================================================
  // ODDS API
  // ============================================================

  oddsSports: () => `${SPORTS_CACHE_PREFIX}:odds:sports`,

  oddsEvents: (sportKey: string) =>
    `${SPORTS_CACHE_PREFIX}:odds:events:${sportKey}`,

  oddsScores: (sportKey: string) =>
    `${SPORTS_CACHE_PREFIX}:odds:scores:${sportKey}`,

  odds: (eventId: string) => `${SPORTS_CACHE_PREFIX}:odds:${eventId}`,

  // ============================================================
  // YOUTUBE
  // ============================================================

  youtubeHighlight: (fixtureId: string) =>
    `${SPORTS_CACHE_PREFIX}:youtube:${fixtureId}`,
} as const;
