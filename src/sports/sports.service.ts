import { Injectable } from '@nestjs/common';

import { SportsDataReadService } from './services/sports-data-read.service';

@Injectable()
export class SportsService {
  constructor(private readonly sportsDataReadService: SportsDataReadService) {}

  // ============================================================
  // LIVE
  //
  // Live data is supplied by the Odds API provider.
  // ============================================================

  async getLive() {
    return this.sportsDataReadService.getLive();
  }

  // ============================================================
  // FIXTURES
  //
  // Read from Redis / MongoDB only.
  // ============================================================

  async getFixtures(competitionCode: string) {
    return this.sportsDataReadService.getFixtures(competitionCode);
  }

  // ============================================================
  // RESULTS
  //
  // Read from Redis / MongoDB only.
  // ============================================================

  async getResults(competitionCode: string) {
    return this.sportsDataReadService.getResults(competitionCode);
  }

  // ============================================================
  // STANDINGS
  //
  // Read from Redis / MongoDB only.
  // ============================================================

  async getStandings(competitionCode: string) {
    return this.sportsDataReadService.getStandings(competitionCode);
  }

  // ============================================================
  // COMPETITIONS
  //
  // Read from Redis / MongoDB only.
  // ============================================================

  async getCompetitions() {
    return this.sportsDataReadService.getCompetitions();
  }

  // ============================================================
  // TEAMS
  //
  // Read from Redis / MongoDB only.
  // ============================================================

  async getTeams(competitionId: string) {
    return this.sportsDataReadService.getTeams(competitionId);
  }

  async getActiveCompetitions() {
    return this.sportsDataReadService.getActiveCompetitions();
  }
}
