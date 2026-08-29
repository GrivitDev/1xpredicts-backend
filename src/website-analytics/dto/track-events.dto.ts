import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import { AnalyticsEventType } from '../enums/analytics-event-type.enum';

export class TrackEventDto {
  @IsString()
  visitorId!: string;

  @IsString()
  sessionId!: string;

  @IsEnum(AnalyticsEventType)
  eventType!: AnalyticsEventType;

  @IsString()
  eventName!: string;

  @IsString()
  path!: string;

  @IsOptional()
  @IsString()
  pageTitle?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @IsString()
  occurredAt!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(86400000)
  durationMs?: number;

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

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsString()
  eventId!: string;
}

export class TrackEventsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TrackEventDto)
  events!: TrackEventDto[];
}
