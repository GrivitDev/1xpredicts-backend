import { Injectable } from '@nestjs/common';

import { SportsDataReadService } from './services/sports-data-read.service';

@Injectable()
export class SportsService {
  constructor(private readonly sportsDataReadService: SportsDataReadService) {}

  async getLive() {
    return this.sportsDataReadService.getLive();
  }

  async getFixtures(competitionId?: string) {
    return this.sportsDataReadService.getFixtures(competitionId);
  }

  async getResults(competitionId?: string) {
    return this.sportsDataReadService.getResults(competitionId);
  }

  async getStandings(competitionId: string) {
    return this.sportsDataReadService.getStandings(competitionId);
  }

  async getCompetitions(options?: {
    activeOnly?: boolean;
    predictionEnabled?: boolean;
  }) {
    return this.sportsDataReadService.getCompetitions(options);
  }

  async getTeams(competitionId: string) {
    return this.sportsDataReadService.getTeams(competitionId);
  }

  async getActiveCompetitions() {
    return this.sportsDataReadService.getActiveCompetitions();
  }
}
