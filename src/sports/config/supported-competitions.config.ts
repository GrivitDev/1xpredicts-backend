import { CollectionFrequency } from '../enums/collection-frequency.enum';

import { CompetitionPriority } from '../enums/competition-priority.enum';

import { CompetitionRegion } from '../enums/competition-region.enum';

import { CompetitionType } from '../enums/competition-type.enum';

import { SupportedLeague } from '../enums/supported-league.enum';

import { SupportedClubCompetition } from '../enums/supported-club-competition.enum';

import { SupportedInternationalCompetition } from '../enums/supported-international-competition.enum';

import { SupportedCompetitionConfig } from '../interfaces/supported-competition-config.interface';

import { FOOTBALL_DATA_COVERAGE } from './football-data-coverage.config';

// ============================================================
// FOOTBALL-DATA MAPPINGS
// ============================================================

const FOOTBALL_DATA_CODES: Record<string, string> = {};

for (const coverage of FOOTBALL_DATA_COVERAGE) {
  FOOTBALL_DATA_CODES[coverage.internalCompetitionId] = coverage.code;
}

// ============================================================
// API-FOOTBALL MAPPINGS
// ============================================================

const API_FOOTBALL_MAPPINGS: Record<
  string,
  {
    name: string;
    country: string;
  }
> = {
  PREMIER_LEAGUE: {
    name: 'Premier League',
    country: 'England',
  },

  CHAMPIONSHIP: {
    name: 'Championship',
    country: 'England',
  },

  LEAGUE_ONE: {
    name: 'League One',
    country: 'England',
  },

  LA_LIGA: {
    name: 'La Liga',
    country: 'Spain',
  },

  SERIE_A: {
    name: 'Serie A',
    country: 'Italy',
  },

  BUNDESLIGA: {
    name: 'Bundesliga',
    country: 'Germany',
  },

  LIGUE_1: {
    name: 'Ligue 1',
    country: 'France',
  },

  EREDIVISIE: {
    name: 'Eredivisie',
    country: 'Netherlands',
  },

  PRIMEIRA_LIGA: {
    name: 'Primeira Liga',
    country: 'Portugal',
  },

  SCOTTISH_PREMIERSHIP: {
    name: 'Premiership',
    country: 'Scotland',
  },

  BELGIAN_PRO_LEAGUE: {
    name: 'Jupiler Pro League',
    country: 'Belgium',
  },

  TURKISH_SUPER_LIG: {
    name: 'Süper Lig',
    country: 'Turkey',
  },

  GREEK_SUPER_LEAGUE: {
    name: 'Super League 1',
    country: 'Greece',
  },

  AUSTRIAN_BUNDESLIGA: {
    name: 'Bundesliga',
    country: 'Austria',
  },

  SWISS_SUPER_LEAGUE: {
    name: 'Super League',
    country: 'Switzerland',
  },

  DANISH_SUPERLIGA: {
    name: 'Superliga',
    country: 'Denmark',
  },

  ELITESERIEN: {
    name: 'Eliteserien',
    country: 'Norway',
  },

  ALLSVENSKAN: {
    name: 'Allsvenskan',
    country: 'Sweden',
  },

  NPFL: {
    name: 'NPFL',
    country: 'Nigeria',
  },

  SOUTH_AFRICA_PREMIER_DIVISION: {
    name: 'Premier Division',
    country: 'South-Africa',
  },

  EGYPTIAN_PREMIER_LEAGUE: {
    name: 'Premier League',
    country: 'Egypt',
  },

  BOTOLA_PRO: {
    name: 'Botola Pro',
    country: 'Morocco',
  },

  GHANA_PREMIER_LEAGUE: {
    name: 'Premier League',
    country: 'Ghana',
  },

  KENYA_PREMIER_LEAGUE: {
    name: 'FKF Premier League',
    country: 'Kenya',
  },

  BRAZIL_SERIE_A: {
    name: 'Serie A',
    country: 'Brazil',
  },

  ARGENTINA_PRIMERA: {
    name: 'Liga Profesional Argentina',
    country: 'Argentina',
  },

  LIGA_MX: {
    name: 'Liga MX',
    country: 'Mexico',
  },

  MLS: {
    name: 'Major League Soccer',
    country: 'USA',
  },

  SAUDI_PRO_LEAGUE: {
    name: 'Pro League',
    country: 'Saudi-Arabia',
  },
};

// ============================================================
// DISPLAY NAMES
// ============================================================

const DISPLAY_NAMES: Record<string, string> = {
  PREMIER_LEAGUE: 'Premier League',
  CHAMPIONSHIP: 'Championship',
  LEAGUE_ONE: 'League One',
  LA_LIGA: 'La Liga',
  SERIE_A: 'Serie A',
  BUNDESLIGA: 'Bundesliga',
  LIGUE_1: 'Ligue 1',
  EREDIVISIE: 'Eredivisie',
  PRIMEIRA_LIGA: 'Primeira Liga',
  SCOTTISH_PREMIERSHIP: 'Scottish Premiership',
  BELGIAN_PRO_LEAGUE: 'Belgian Pro League',
  TURKISH_SUPER_LIG: 'Turkish Super Lig',
  GREEK_SUPER_LEAGUE: 'Greek Super League',
  AUSTRIAN_BUNDESLIGA: 'Austrian Bundesliga',
  SWISS_SUPER_LEAGUE: 'Swiss Super League',
  DANISH_SUPERLIGA: 'Danish Superliga',
  ELITESERIEN: 'Eliteserien',
  ALLSVENSKAN: 'Allsvenskan',
  NPFL: 'Nigeria Premier Football League',
  SOUTH_AFRICA_PREMIER_DIVISION: 'South African Premier Division',
  EGYPTIAN_PREMIER_LEAGUE: 'Egyptian Premier League',
  BOTOLA_PRO: 'Botola Pro',
  GHANA_PREMIER_LEAGUE: 'Ghana Premier League',
  KENYA_PREMIER_LEAGUE: 'Kenya Premier League',
  BRAZIL_SERIE_A: 'Brazil Serie A',
  ARGENTINA_PRIMERA: 'Argentina Primera Division',
  LIGA_MX: 'Liga MX',
  MLS: 'MLS',
  SAUDI_PRO_LEAGUE: 'Saudi Pro League',
};

const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  CHAMPIONS_LEAGUE: 'UEFA Champions League',
  UEFA_CHAMPIONS_LEAGUE: 'UEFA Champions League',

  EUROPA_LEAGUE: 'UEFA Europa League',
  UEFA_EUROPA_LEAGUE: 'UEFA Europa League',

  CONFERENCE_LEAGUE: 'UEFA Europa Conference League',
  UEFA_CONFERENCE_LEAGUE: 'UEFA Europa Conference League',

  WORLD_CUP: 'FIFA World Cup',
  FIFA_WORLD_CUP: 'FIFA World Cup',

  EURO: 'UEFA European Championship',
  UEFA_EURO: 'UEFA European Championship',
};

// ============================================================
// HELPERS
// ============================================================

function toDisplayName(value: string): string {
  if (DISPLAY_NAMES[value]) {
    return DISPLAY_NAMES[value];
  }

  if (DISPLAY_NAME_OVERRIDES[value]) {
    return DISPLAY_NAME_OVERRIDES[value];
  }

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function createId(value: string): string {
  return value.trim().toLowerCase();
}

function getFootballDataMapping(value: string): {
  footballDataCode?: string;
} {
  const code = FOOTBALL_DATA_CODES[value];

  if (!code) {
    return {};
  }

  return {
    footballDataCode: code,
  };
}

function getApiFootballMapping(value: string): {
  apiFootballName?: string;
  apiFootballCountry?: string;
} {
  const mapping = API_FOOTBALL_MAPPINGS[value];

  if (!mapping) {
    return {};
  }

  return {
    apiFootballName: mapping.name,
    apiFootballCountry: mapping.country,
  };
}

function buildCompetition(
  value: string,
  type: CompetitionType,
  region: CompetitionRegion,
  priority: CompetitionPriority,
  collectionFrequency: CollectionFrequency,
  options?: {
    predictionEnabled?: boolean;

    oddsEnabled?: boolean;

    newsEnabled?: boolean;

    providers?: {
      apiFootballName?: string;
      apiFootballCountry?: string;
      apiFootballId?: number;
      footballDataCode?: string;
      sportsDbLeagueId?: number;
      oddsApiSportKey?: string;
    };

    seasonal?: boolean;

    gender?: 'MEN' | 'WOMEN';

    notes?: string;
  },
): SupportedCompetitionConfig {
  return {
    id: createId(value),

    name: toDisplayName(value),

    type,

    region,

    priority,

    enabled: true,

    predictionEnabled: options?.predictionEnabled ?? true,

    oddsEnabled: options?.oddsEnabled ?? true,

    newsEnabled: options?.newsEnabled ?? true,

    collectionFrequency,

    providers: {
      ...getFootballDataMapping(value),
      ...getApiFootballMapping(value),
      ...options?.providers,
    },

    seasonal: options?.seasonal ?? false,

    gender: options?.gender ?? 'MEN',

    notes: options?.notes,
  };
}

// ============================================================
// DOMESTIC LEAGUES
// ============================================================

const DOMESTIC_LEAGUES: SupportedCompetitionConfig[] = Object.values(
  SupportedLeague,
).map((league) =>
  buildCompetition(
    league,

    CompetitionType.LEAGUE,

    league === SupportedLeague.NPFL
      ? CompetitionRegion.NIGERIA
      : league === SupportedLeague.BRAZIL_SERIE_A
        ? CompetitionRegion.SOUTH_AMERICA
        : league === SupportedLeague.ARGENTINA_PRIMERA
          ? CompetitionRegion.SOUTH_AMERICA
          : league === SupportedLeague.LIGA_MX || league === SupportedLeague.MLS
            ? CompetitionRegion.NORTH_AMERICA
            : league === SupportedLeague.SAUDI_PRO_LEAGUE
              ? CompetitionRegion.ASIA
              : league === SupportedLeague.SOUTH_AFRICA_PREMIER_DIVISION ||
                  league === SupportedLeague.EGYPTIAN_PREMIER_LEAGUE ||
                  league === SupportedLeague.BOTOLA_PRO ||
                  league === SupportedLeague.GHANA_PREMIER_LEAGUE ||
                  league === SupportedLeague.KENYA_PREMIER_LEAGUE
                ? CompetitionRegion.AFRICA
                : CompetitionRegion.EUROPE,

    [
      SupportedLeague.PREMIER_LEAGUE,
      SupportedLeague.LA_LIGA,
      SupportedLeague.SERIE_A,
      SupportedLeague.BUNDESLIGA,
      SupportedLeague.LIGUE_1,
    ].includes(league)
      ? CompetitionPriority.ELITE
      : [
            SupportedLeague.CHAMPIONSHIP,
            SupportedLeague.EREDIVISIE,
            SupportedLeague.PRIMEIRA_LIGA,
            SupportedLeague.BRAZIL_SERIE_A,
            SupportedLeague.ARGENTINA_PRIMERA,
          ].includes(league)
        ? CompetitionPriority.HIGH
        : CompetitionPriority.REGIONAL,

    CollectionFrequency.DAILY,
  ),
);

// ============================================================
// CLUB COMPETITIONS
// ============================================================

const CLUB_COMPETITIONS: SupportedCompetitionConfig[] = Object.values(
  SupportedClubCompetition,
).map((competition) =>
  buildCompetition(
    competition,

    CompetitionType.CLUB_COMPETITION,

    CompetitionRegion.EUROPE,

    competition.includes('CHAMPIONS')
      ? CompetitionPriority.ELITE
      : CompetitionPriority.HIGH,

    CollectionFrequency.DAILY,

    {
      seasonal: true,
    },
  ),
);

// ============================================================
// INTERNATIONAL COMPETITIONS
// ============================================================

const INTERNATIONAL_COMPETITIONS: SupportedCompetitionConfig[] = Object.values(
  SupportedInternationalCompetition,
).map((competition) =>
  buildCompetition(
    competition,

    CompetitionType.INTERNATIONAL,

    CompetitionRegion.WORLD,

    competition.includes('WORLD_CUP')
      ? CompetitionPriority.ELITE
      : CompetitionPriority.HIGH,

    CollectionFrequency.SEASONAL,

    {
      seasonal: true,

      oddsEnabled: true,

      predictionEnabled: true,
    },
  ),
);

// ============================================================
// COMPLETE CONFIGURATION
// ============================================================

export const SUPPORTED_COMPETITIONS: SupportedCompetitionConfig[] = [
  ...DOMESTIC_LEAGUES,

  ...CLUB_COMPETITIONS,

  ...INTERNATIONAL_COMPETITIONS,
];

// ============================================================
// LOOKUPS
// ============================================================

export const SUPPORTED_COMPETITIONS_BY_ID = new Map(
  SUPPORTED_COMPETITIONS.map((competition) => [competition.id, competition]),
);

export function getSupportedCompetition(
  competitionId: string,
): SupportedCompetitionConfig | undefined {
  return SUPPORTED_COMPETITIONS_BY_ID.get(competitionId.trim().toLowerCase());
}

export function validateSupportedCompetitions(): void {
  if (SUPPORTED_COMPETITIONS.length !== 58) {
    throw new Error(
      `Expected 58 supported competitions, found ${SUPPORTED_COMPETITIONS.length}`,
    );
  }

  const ids = new Set<string>();

  for (const competition of SUPPORTED_COMPETITIONS) {
    if (ids.has(competition.id)) {
      throw new Error(`Duplicate competition ID: ${competition.id}`);
    }

    ids.add(competition.id);
  }
}

validateSupportedCompetitions();
