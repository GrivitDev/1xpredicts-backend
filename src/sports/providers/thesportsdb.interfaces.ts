/**
 * TheSportsDB V1 response contracts.
 *
 * These types intentionally represent TheSportsDB data only.
 */

export interface SportsDbResponse<T> {
  events?: T[];
  teams?: T[];
  players?: T[];
  table?: T[];
  venues?: T[];
}

export interface SportsDbEvent {
  idEvent: string;

  strEvent?: string | null;

  idLeague?: string | null;
  strLeague?: string | null;

  idSeason?: string | null;
  strSeason?: string | null;

  idHomeTeam?: string | null;
  strHomeTeam?: string | null;

  idAwayTeam?: string | null;
  strAwayTeam?: string | null;

  dateEvent?: string | null;
  strTime?: string | null;
  strTimestamp?: string | null;

  strStatus?: string | null;

  intHomeScore?: number | null;
  intAwayScore?: number | null;

  intHomeScoreHalf?: number | null;
  intAwayScoreHalf?: number | null;

  intHomeScoreExtra?: number | null;
  intAwayScoreExtra?: number | null;

  intAwayScorePen?: number | null;
  intHomeScorePen?: number | null;

  strVenue?: string | null;
  idVenue?: string | null;

  strCountry?: string | null;

  strHomeFormation?: string | null;
  strAwayFormation?: string | null;

  strPostponed?: string | null;

  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
}

export interface SportsDbTeam {
  idTeam: string;

  strTeam?: string | null;
  strTeamShort?: string | null;
  strAlternate?: string | null;

  strLeague?: string | null;
  idLeague?: string | null;

  strCountry?: string | null;

  intFormedYear?: string | null;

  strStadium?: string | null;
  idVenue?: string | null;

  intStadiumCapacity?: string | null;

  strDescriptionEN?: string | null;

  strTeamBadge?: string | null;
  strTeamLogo?: string | null;
  strTeamJersey?: string | null;

  strGender?: string | null;
}

export interface SportsDbPlayer {
  idPlayer: string;

  strPlayer?: string | null;
  strNationality?: string | null;

  strTeam?: string | null;
  idTeam?: string | null;

  strPosition?: string | null;

  dateBorn?: string | null;
  strBirthLocation?: string | null;

  strHeight?: string | null;
  strWeight?: string | null;

  strDescriptionEN?: string | null;

  strThumb?: string | null;
  strRender?: string | null;

  strInstagram?: string | null;
  strTwitter?: string | null;
  strFacebook?: string | null;
}

export interface SportsDbTimelineEvent {
  idTimeline?: string | null;

  idEvent?: string | null;

  strTimeline?: string | null;
  strTimelineDetail?: string | null;

  strTime?: string | null;

  idPlayer?: string | null;
  strPlayer?: string | null;

  idTeam?: string | null;
  strTeam?: string | null;

  strEvent?: string | null;
  strComment?: string | null;
}

export interface SportsDbLineupPlayer {
  idEvent?: string | null;

  idPlayer?: string | null;
  strPlayer?: string | null;

  idTeam?: string | null;
  strTeam?: string | null;

  strPosition?: string | null;
  strFormation?: string | null;

  intSquadNumber?: number | null;

  strSubstitute?: string | null;
}

export interface SportsDbStatistic {
  idEvent?: string | null;

  idTeam?: string | null;
  strTeam?: string | null;

  strStat?: string | null;
  intValue?: string | number | null;

  strValue?: string | number | null;
}

export interface SportsDbVenue {
  idVenue: string;

  strVenue?: string | null;
  strVenueAlternate?: string | null;

  strLeague?: string | null;
  strSport?: string | null;

  strCountry?: string | null;
  strCity?: string | null;

  strAddress?: string | null;

  intCapacity?: string | null;

  strSurface?: string | null;

  strDescriptionEN?: string | null;

  strThumb?: string | null;
}

export interface SportsDbSeason {
  strSeason?: string | null;
}

export interface SportsDbEventResult {
  idResult?: string | null;

  idEvent?: string | null;

  idPlayer?: string | null;
  idTeam?: string | null;

  strPlayer?: string | null;
  strTeam?: string | null;

  strResult?: string | null;
  strResultDetail?: string | null;

  intResult?: number | null;
}

export interface SportsDbPlayerStatistic {
  idPlayer?: string | null;

  strPlayer?: string | null;

  idTeam?: string | null;
  strTeam?: string | null;

  idLeague?: string | null;
  strLeague?: string | null;

  idSeason?: string | null;
  strSeason?: string | null;

  [key: string]: unknown;
}
