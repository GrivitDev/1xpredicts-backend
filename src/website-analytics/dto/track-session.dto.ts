import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { AnalyticsVisitorType } from '../enums/analytics-visitor-type.enum';

export class TrackSessionDto {
  @IsString()
  visitorId!: string;

  @IsString()
  sessionId!: string;

  @IsOptional()
  @IsEnum(AnalyticsVisitorType)
  visitorType?: AnalyticsVisitorType;

  @IsString()
  timestamp!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(86400000)
  durationMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(86400000)
  activeTimeMs?: number;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  landingPage?: string;

  @IsOptional()
  @IsString()
  exitPage?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pageViews?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  eventCount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  bounced?: boolean;

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
  @IsInt()
  @Min(0)
  screenWidth?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  screenHeight?: number;

  @IsOptional()
  @IsString()
  referrer?: string;

  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmMedium?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  utmTerm?: string;

  @IsOptional()
  @IsString()
  utmContent?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  city?: string;
}
