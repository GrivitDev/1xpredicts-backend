import { BadRequestException, Controller, Get, Query } from '@nestjs/common';

import { SportsService } from './sports.service';

@Controller('sports')
export class SportsController {
  constructor(private readonly sportsService: SportsService) {}

  // ============================================================
  // LIVE MATCHES
  //
  // This is the only endpoint that uses the
  // live external data path.
  // ============================================================

  @Get('live')
  async getLive() {
    return {
      success: true,
      data: await this.sportsService.getLive(),
    };
  }

  // ============================================================
  // FIXTURES
  //
  // Cached / database only.
  // Uses the internal competition ID so the service can
  // determine the correct provider.
  // ============================================================

  @Get('fixtures')
  async getFixtures(
    @Query('competitionId')
    competitionId?: string,
  ) {
    if (!competitionId?.trim()) {
      throw new BadRequestException('competitionId is required');
    }

    return {
      success: true,
      data: await this.sportsService.getFixtures(competitionId),
    };
  }

  // ============================================================
  // RESULTS
  //
  // Cached / database only.
  // ============================================================

  @Get('results')
  async getResults(
    @Query('competitionId')
    competitionId?: string,
  ) {
    if (!competitionId?.trim()) {
      throw new BadRequestException('competitionId is required');
    }

    return {
      success: true,
      data: await this.sportsService.getResults(competitionId),
    };
  }

  // ============================================================
  // STANDINGS
  //
  // Cached / database only.
  // ============================================================

  @Get('standings')
  async getStandings(
    @Query('competitionId')
    competitionId?: string,
  ) {
    if (!competitionId?.trim()) {
      throw new BadRequestException('competitionId is required');
    }

    return {
      success: true,
      data: await this.sportsService.getStandings(competitionId),
    };
  }

  // ============================================================
  // COMPETITIONS
  //
  // Internal supported competition registry.
  // ============================================================

  @Get('competitions')
  async getCompetitions() {
    return {
      success: true,
      data: await this.sportsService.getCompetitions(),
    };
  }

  // ============================================================
  // ACTIVE COMPETITIONS
  // ============================================================

  @Get('active-competitions')
  async getActiveCompetitions() {
    return {
      success: true,
      data: await this.sportsService.getActiveCompetitions(),
    };
  }

  // ============================================================
  // TEAMS
  //
  // Cached / database only.
  // ============================================================

  @Get('teams')
  async getTeams(
    @Query('competitionId')
    competitionId?: string,
  ) {
    if (!competitionId?.trim()) {
      throw new BadRequestException('competitionId is required');
    }

    return {
      success: true,
      data: await this.sportsService.getTeams(competitionId),
    };
  }
}
