import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { RolesGuard } from '../../common/guards/roles.guard';

import { Roles } from '../../common/decorators/roles.decorator';

import { SettlementService } from '../services/settlement.service';

import { PredictionRunReadService } from '../services/prediction-run-read.service';

@Controller('predictions-engine/settlement')
export class SettlementController {
  constructor(
    private readonly settlementService: SettlementService,

    private readonly predictionRunReadService: PredictionRunReadService,
  ) {}

  @Post(':eventId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'platform_admin')
  async settle(
    @Param('eventId')
    eventId: string,
  ) {
    return this.settlementService.settleEvent(eventId);
  }

  @Get(':eventId')
  @UseGuards(JwtAuthGuard)
  async getSettlement(
    @Param('eventId')
    eventId: string,
  ) {
    return this.predictionRunReadService.findByEvent(eventId);
  }
}
