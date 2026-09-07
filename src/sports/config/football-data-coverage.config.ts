export interface FootballDataCompetitionConfig {
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
  FOOTBALL_DATA_COVERAGE.map((competition) => competition.code),
);

export function getFootballDataCompetitionByInternalId(
  internalCompetitionId: string,
): FootballDataCompetitionConfig | undefined {
  const normalizedId = internalCompetitionId.trim().toUpperCase();

  return FOOTBALL_DATA_COVERAGE.find(
    (competition) => competition.internalCompetitionId === normalizedId,
  );
}

export function hasFootballDataCoverage(
  internalCompetitionId: string,
): boolean {
  return (
    getFootballDataCompetitionByInternalId(internalCompetitionId) !== undefined
  );
}
