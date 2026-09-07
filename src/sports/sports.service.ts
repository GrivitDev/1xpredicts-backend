import { Injectable } from '@nestjs/common';

import { SportsDataReadService } from './services/sports-data-read.service';

@Injectable()
export class SportsService {
  constructor(private readonly sportsDataReadService: SportsDataReadService) {}

  async getLive() {
    return this.sportsDataReadService.getLive();
  }

  async getFixtures(competitionCode: string) {
    return this.sportsDataReadService.getFixtures(competitionCode);
  }

  async getResults(competitionCode: string) {
    return this.sportsDataReadService.getResults(competitionCode);
  }

  async getStandings(competitionCode: string) {
    return this.sportsDataReadService.getStandings(competitionCode);
  }

  async getCompetitions() {
    return this.sportsDataReadService.getCompetitions();
  }

  async getTeams(competitionId: string) {
    return this.sportsDataReadService.getTeams(competitionId);
  }

  async getActiveCompetitions() {
    return this.sportsDataReadService.getActiveCompetitions();
  }
}
