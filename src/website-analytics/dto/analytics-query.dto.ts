import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { AnalyticsVisitorType } from '../enums/analytics-visitor-type.enum';

export class AnalyticsQueryDto {
  // ==========================================
  // DATE RANGE
  // ==========================================

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  // ==========================================
  // FILTERS
  // ==========================================

  @IsOptional()
  @IsEnum(AnalyticsVisitorType)
  visitorType?: AnalyticsVisitorType;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsOptional()
  @IsString()
  browser?: string;

  @IsOptional()
  @IsString()
  operatingSystem?: string;

  @IsOptional()
  @IsString()
  path?: string;

  // ==========================================
  // PAGINATION
  // ==========================================

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
