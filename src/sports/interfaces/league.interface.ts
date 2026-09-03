export interface SportsLeague {
  id: string;
  name: string;
  type: string;
  region: string;
  priority: string;

  enabled: boolean;
  predictionEnabled: boolean;
  oddsEnabled: boolean;
  newsEnabled: boolean;

  providers: {
    apiFootballId?: number;
    footballDataCode?: string;
    sportsDbLeagueId?: number;
    oddsApiSportKey?: string;
  };
}
