import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { SportsDataReadService } from './services/sports-data-read.service';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('sports')
export class SportsController {
  constructor(private readonly sportsDataReadService: SportsDataReadService) {}

  @Get('competitions')
  async getCompetitions(
    @Query('activeOnly') activeOnly?: string,
    @Query('predictionEnabled') predictionEnabled?: string,
  ) {
    return this.sportsDataReadService.getCompetitions({
      activeOnly: activeOnly === 'true',
      predictionEnabled: predictionEnabled === 'true',
    });
  }

  @Get('competitions/:competitionId')
  async getCompetition(
    @Param('competitionId') competitionId: string,
    @Query('season') season?: string,
  ) {
    return this.sportsDataReadService.getCompetition(
      competitionId,
      season ? Number(season) : undefined,
    );
  }

  @Get('fixtures/upcoming')
  async getUpcomingFixtures(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('competitionId') competitionId?: string,
  ) {
    return this.sportsDataReadService.getUpcomingFixtures(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      competitionId,
    );
  }

  @Get('fixtures/live')
  async getLiveFixtures(@Query('competitionId') competitionId?: string) {
    return this.sportsDataReadService.getLiveFixtures(competitionId);
  }

  @Get('fixtures/finished')
  async getFinishedFixtures(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('competitionId') competitionId?: string,
  ) {
    return this.sportsDataReadService.getFinishedFixtures(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      competitionId,
    );
  }

  @Get('competitions/:competitionId/table')
  async getLeagueTable(
    @Param('competitionId') competitionId: string,
    @Query('season') season?: string,
  ) {
    return this.sportsDataReadService.getLeagueTable(
      competitionId,
      season ? Number(season) : undefined,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('competitions/:competitionId/team-stats')
  async getTeamCompetitionStats(
    @Param('competitionId') competitionId: string,
    @Query('season') season: string,
  ) {
    return this.sportsDataReadService.getTeamCompetitionStats(
      competitionId,
      Number(season),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('competitions/:competitionId/team-stats/:teamId')
  async getTeamStats(
    @Param('competitionId') competitionId: string,
    @Param('teamId') teamId: string,
    @Query('season') season: string,
  ) {
    return this.sportsDataReadService.getTeamStats(
      competitionId,
      Number(season),
      Number(teamId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('head-to-head/:teamOneId/:teamTwoId')
  async getHeadToHead(
    @Param('teamOneId') teamOneId: string,
    @Param('teamTwoId') teamTwoId: string,
  ) {
    return this.sportsDataReadService.getHeadToHead(
      Number(teamOneId),
      Number(teamTwoId),
    );
  }

  @Get('odds/event/:eventId')
  async getOddsForEvent(@Param('eventId') eventId: string) {
    return this.sportsDataReadService.getOddsForEvent(eventId);
  }

  @Get('youtube/:fixtureId')
  async getYoutubeHighlight(@Param('fixtureId') fixtureId: string) {
    return this.sportsDataReadService.getYoutubeHighlight(fixtureId);
  }
}
