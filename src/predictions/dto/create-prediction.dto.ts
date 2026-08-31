import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';

import { Type } from 'class-transformer';

class ProbabilitiesDto {
  @IsNumber()
  home!: number;

  @IsNumber()
  draw!: number;

  @IsNumber()
  away!: number;
}

class MarketDto {
  @IsString()
  market!: string;

  @IsOptional()
  @IsString()
  selection?: string;

  @IsOptional()
  @IsString()
  playerId?: string;

  @IsOptional()
  @IsString()
  playerName?: string;
}

class LeagueDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  country!: string;

  @IsOptional()
  @IsString()
  emblem?: string;
}

export class CreatePredictionDto {
  @IsString()
  matchId!: string;

  @IsString()
  leagueCode!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LeagueDto)
  league?: LeagueDto;

  @IsString()
  homeTeam!: string;

  @IsString()
  awayTeam!: string;

  @IsOptional()
  @IsString()
  homeTeamBadge?: string;

  @IsOptional()
  @IsString()
  awayTeamBadge?: string;

  @ValidateNested()
  @Type(() => ProbabilitiesDto)
  probabilities!: ProbabilitiesDto;

  @IsNumber()
  @Min(1)
  @Max(100)
  confidence!: number;

  @IsEnum(['free', 'regular', 'vip'])
  accessType!: 'free' | 'regular' | 'vip';

  @IsString()
  matchDate!: string;

  @IsOptional()
  @ValidateNested({
    each: true,
  })
  @Type(() => MarketDto)
  markets?: MarketDto[];
}
