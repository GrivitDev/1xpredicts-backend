import { Controller, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { RolesGuard } from '../../common/guards/roles.guard';

import { Roles } from '../../common/decorators/roles.decorator';

import { PredictionTriggerService } from '../services/prediction-trigger.service';

@Controller('predictions-engine')
export class PredictionsEngineController {
  constructor(
    private readonly predictionTriggerService: PredictionTriggerService,
  ) {}

  @Post('trigger')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'platform_admin')
  async trigger() {
    return this.predictionTriggerService.trigger();
  }
}
