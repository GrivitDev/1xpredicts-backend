/**
 * football-data.org free-tier coverage.
 *
 * This is deliberately separate from 2xPredict's 60 competition
 * universe.
 *
 * The provider's currently documented free competition set is
 * maintained independently from our internal configuration.
 */

export interface FootballDataCompetitionConfig {
  [x: string]: any;
  code: string;

  name: string;

  internalCompetitionId: string;
}

export const FOOTBALL_DATA_COVERAGE: FootballDataCompetitionConfig[] = [
  {
    code: 'PL',
    name: 'Premier League',
    internalCompetitionId: 'PREMIER_LEAGUE',
  },

  {
    code: 'ELC',
    name: 'Championship',
    internalCompetitionId: 'CHAMPIONSHIP',
  },

  {
    code: 'PD',
    name: 'La Liga',
    internalCompetitionId: 'LA_LIGA',
  },

  {
    code: 'SA',
    name: 'Serie A',
    internalCompetitionId: 'SERIE_A',
  },

  {
    code: 'BL1',
    name: 'Bundesliga',
    internalCompetitionId: 'BUNDESLIGA',
  },

  {
    code: 'FL1',
    name: 'Ligue 1',
    internalCompetitionId: 'LIGUE_1',
  },

  {
    code: 'DED',
    name: 'Eredivisie',
    internalCompetitionId: 'EREDIVISIE',
  },

  {
    code: 'PPL',
    name: 'Primeira Liga',
    internalCompetitionId: 'PRIMEIRA_LIGA',
  },

  {
    code: 'BSA',
    name: 'Brazil Serie A',
    internalCompetitionId: 'BRAZIL_SERIE_A',
  },

  {
    code: 'CL',
    name: 'UEFA Champions League',
    internalCompetitionId: 'UEFA_CHAMPIONS_LEAGUE',
  },

  {
    code: 'WC',
    name: 'FIFA World Cup',
    internalCompetitionId: 'FIFA_WORLD_CUP',
  },

  {
    code: 'EC',
    name: 'UEFA European Championship',
    internalCompetitionId: 'UEFA_EURO',
  },
];

export const FOOTBALL_DATA_CODES = new Set(
  FOOTBALL_DATA_COVERAGE.map((item) => item.code),
);

export function getFootballDataCompetitionByInternalId(
  internalCompetitionId: string,
): FootballDataCompetitionConfig | undefined {
  return FOOTBALL_DATA_COVERAGE.find(
    (item) => item.internalCompetitionId === internalCompetitionId,
  );
}

export function hasFootballDataCoverage(
  internalCompetitionId: string,
): boolean {
  return FOOTBALL_DATA_COVERAGE.some(
    (item) => item.internalCompetitionId === internalCompetitionId,
  );
}
