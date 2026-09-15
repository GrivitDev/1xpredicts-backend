import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { PredictionReadService } from '../services/prediction-read.service';

import { PredictionRunReadService } from '../services/prediction-run-read.service';

import { PredictionMarket } from '../enums/prediction-market.enum';

import { PredictionStatus } from '../enums/prediction-status.enum';

import { PredictionQuery } from '../interfaces/prediction-query.interface';

@Controller('predictions-engine')
@UseGuards(JwtAuthGuard)
export class PredictionsReadController {
  constructor(
    private readonly predictionReadService: PredictionReadService,

    private readonly predictionRunReadService: PredictionRunReadService,
  ) {}

  @Get()
  async find(
    @Query('eventId')
    eventId?: string,

    @Query('competitionId')
    competitionId?: string,

    @Query('market')
    market?: PredictionMarket,

    @Query('status')
    status?: PredictionStatus,

    @Query('from')
    from?: string,

    @Query('to')
    to?: string,

    @Query('page')
    page?: string,

    @Query('limit')
    limit?: string,
  ) {
    const query: PredictionQuery = {
      eventId: eventId?.trim(),

      competitionId: competitionId?.trim(),

      market,

      status,

      from: this.parseDate(from),

      to: this.parseDate(to),

      page: this.parsePositiveNumber(page),

      limit: this.parsePositiveNumber(limit),
    };

    return this.predictionReadService.find(query);
  }

  @Get('upcoming')
  async findUpcoming(
    @Query('limit')
    limit?: string,
  ) {
    return this.predictionReadService.findUpcoming(
      this.parsePositiveNumber(limit),
    );
  }

  @Get('settled')
  async findSettled(
    @Query('limit')
    limit?: string,
  ) {
    return this.predictionReadService.findSettled(
      this.parsePositiveNumber(limit),
    );
  }

  @Get('events/:eventId')
  async findByEvent(
    @Param('eventId')
    eventId: string,
  ) {
    return this.predictionReadService.findByEvent(eventId);
  }

  @Get('runs/recent')
  async findRecentRuns(
    @Query('limit')
    limit?: string,
  ) {
    return this.predictionRunReadService.findRecent(
      this.parsePositiveNumber(limit),
    );
  }

  @Get('runs/upcoming')
  async findUpcomingRuns(
    @Query('limit')
    limit?: string,
  ) {
    return this.predictionRunReadService.findUpcoming(
      this.parsePositiveNumber(limit),
    );
  }

  @Get('runs/:eventId')
  async findRun(
    @Param('eventId')
    eventId: string,
  ) {
    return this.predictionRunReadService.findByEvent(eventId);
  }

  private parsePositiveNumber(value?: string): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    const number = Number(value);

    if (!Number.isFinite(number) || number < 1) {
      return undefined;
    }

    return Math.floor(number);
  }

  private parseDate(value?: string): Date | undefined {
    if (!value?.trim()) {
      return undefined;
    }

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return undefined;
    }

    return date;
  }
}
