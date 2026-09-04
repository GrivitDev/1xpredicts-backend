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

  LA_LIGA: 'La Liga',
  SERIE_A: 'Serie A',
  BUNDESLIGA: 'Bundesliga',
  LIGUE_1: 'Ligue 1',

  EREDIVISIE: 'Eredivisie',
  PRIMEIRA_LIGA: 'Primeira Liga',
  SCOTTISH_PREMIERSHIP: 'Scottish Premiership',
  BELGIAN_PRO_LEAGUE: 'Belgian Pro League',
  TURKISH_SUPER_LIG: 'Turkish Super Lig',

  NPFL: 'Nigeria Premier Football League',
  SOUTH_AFRICA_PREMIER_DIVISION: 'South African Premier Division',
  EGYPTIAN_PREMIER_LEAGUE: 'Egyptian Premier League',
  BOTOLA_PRO: 'Botola Pro',

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

  WORLD_CUP_QUALIFIERS: 'FIFA World Cup Qualifiers',
  FIFA_WORLD_CUP_QUALIFIERS: 'FIFA World Cup Qualifiers',

  AFCON: 'Africa Cup of Nations',
  AFCON_QUALIFIERS: 'Africa Cup of Nations Qualifiers',

  EURO_QUALIFIERS: 'UEFA European Championship Qualifiers',
  UEFA_EURO_QUALIFIERS: 'UEFA European Championship Qualifiers',

  UEFA_NATIONS_LEAGUE: 'UEFA Nations League',

  COPA_AMERICA: 'Copa America',

  CONCACAF_GOLD_CUP: 'CONCACAF Gold Cup',
  CONCACAF_NATIONS_LEAGUE: 'CONCACAF Nations League',

  AFC_ASIAN_CUP: 'AFC Asian Cup',

  CAF_CHAMPIONS_LEAGUE: 'CAF Champions League',
  CAF_CONFEDERATION_CUP: 'CAF Confederation Cup',

  COPA_LIBERTADORES: 'Copa Libertadores',
  COPA_SUDAMERICANA: 'Copa Sudamericana',

  CONCACAF_CHAMPIONS_CUP: 'CONCACAF Champions Cup',
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
      : league === SupportedLeague.BRAZIL_SERIE_A ||
          league === SupportedLeague.ARGENTINA_PRIMERA
        ? CompetitionRegion.SOUTH_AMERICA
        : league === SupportedLeague.LIGA_MX || league === SupportedLeague.MLS
          ? CompetitionRegion.NORTH_AMERICA
          : league === SupportedLeague.SAUDI_PRO_LEAGUE
            ? CompetitionRegion.ASIA
            : league === SupportedLeague.SOUTH_AFRICA_PREMIER_DIVISION ||
                league === SupportedLeague.EGYPTIAN_PREMIER_LEAGUE ||
                league === SupportedLeague.BOTOLA_PRO
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
            SupportedLeague.SCOTTISH_PREMIERSHIP,
            SupportedLeague.BELGIAN_PRO_LEAGUE,
            SupportedLeague.TURKISH_SUPER_LIG,
            SupportedLeague.NPFL,
            SupportedLeague.BRAZIL_SERIE_A,
            SupportedLeague.ARGENTINA_PRIMERA,
            SupportedLeague.LIGA_MX,
            SupportedLeague.MLS,
            SupportedLeague.SAUDI_PRO_LEAGUE,
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

    competition === SupportedClubCompetition.CAF_CHAMPIONS_LEAGUE ||
      competition === SupportedClubCompetition.CAF_CONFEDERATION_CUP
      ? CompetitionRegion.AFRICA
      : competition === SupportedClubCompetition.COPA_LIBERTADORES ||
          competition === SupportedClubCompetition.COPA_SUDAMERICANA
        ? CompetitionRegion.SOUTH_AMERICA
        : competition === SupportedClubCompetition.CONCACAF_CHAMPIONS_CUP
          ? CompetitionRegion.NORTH_AMERICA
          : CompetitionRegion.EUROPE,

    competition === SupportedClubCompetition.UEFA_CHAMPIONS_LEAGUE ||
      competition === SupportedClubCompetition.CAF_CHAMPIONS_LEAGUE ||
      competition === SupportedClubCompetition.COPA_LIBERTADORES
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

    competition === SupportedInternationalCompetition.AFCON ||
      competition === SupportedInternationalCompetition.AFCON_QUALIFIERS
      ? CompetitionRegion.AFRICA
      : competition === SupportedInternationalCompetition.COPA_AMERICA
        ? CompetitionRegion.SOUTH_AMERICA
        : competition === SupportedInternationalCompetition.CONCACAF_GOLD_CUP ||
            competition ===
              SupportedInternationalCompetition.CONCACAF_NATIONS_LEAGUE
          ? CompetitionRegion.NORTH_AMERICA
          : competition === SupportedInternationalCompetition.AFC_ASIAN_CUP
            ? CompetitionRegion.ASIA
            : CompetitionRegion.WORLD,

    competition === SupportedInternationalCompetition.FIFA_WORLD_CUP ||
      competition ===
        SupportedInternationalCompetition.FIFA_WORLD_CUP_QUALIFIERS ||
      competition === SupportedInternationalCompetition.AFCON
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

// ============================================================
// VALIDATION
// ============================================================

export function validateSupportedCompetitions(): void {
  const expectedCompetitionCount = 39;

  if (SUPPORTED_COMPETITIONS.length !== expectedCompetitionCount) {
    throw new Error(
      `Expected ${expectedCompetitionCount} supported competitions, found ${SUPPORTED_COMPETITIONS.length}`,
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
