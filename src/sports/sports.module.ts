import { Module } from '@nestjs/common';

import { MongooseModule } from '@nestjs/mongoose';

import { ScheduleModule } from '@nestjs/schedule';

import { SportsController } from './sports.controller';

import { SportsService } from './sports.service';

import {
  ActiveCompetition,
  ActiveCompetitionSchema,
} from './schemas/active-competition.schema';

import {
  ApiFootballQueue,
  ApiFootballQueueSchema,
} from './schemas/api-football-queue.schema';

import {
  ApiFootballFixture,
  ApiFootballFixtureSchema,
} from './schemas/api-football/api-football-fixture.schema';

import {
  ApiFootballStanding,
  ApiFootballStandingSchema,
} from './schemas/api-football/api-football-standing.schema';

import {
  FootballDataCompetition,
  FootballDataCompetitionSchema,
} from './schemas/football-data/football-data-competition.schema';

import {
  FootballDataMatch,
  FootballDataMatchSchema,
} from './schemas/football-data/football-data-match.schema';

import {
  FootballDataStanding,
  FootballDataStandingSchema,
} from './schemas/football-data/football-data-standing.schema';

import {
  FootballDataTeam,
  FootballDataTeamSchema,
} from './schemas/football-data/football-data-team.schema';

import {
  OddsApiSport,
  OddsApiSportSchema,
} from './schemas/odds-api-sport.schema';

import {
  SportsOddsSnapshot,
  SportsOddsSnapshotSchema,
} from './schemas/sports-odds-snapshot.schema';

import {
  SportsProviderRateLimit,
  SportsProviderRateLimitSchema,
} from './schemas/sports-provider-rate-limit.schema';

import {
  TeamCompetitionStats,
  TeamCompetitionStatsSchema,
} from './schemas/team-competition-stats.schema';

import { HeadToHead, HeadToHeadSchema } from './schemas/head-to-head.schema';

import {
  YouTubeHighlight,
  YouTubeHighlightSchema,
} from './schemas/youtube-highlight.schema';

import { ApiFootballService } from './providers/api-football.service';

import { FootballDataService } from './providers/football-data.service';

import { TheOddsApiService } from './providers/the-odds-api.service';

import { YoutubeService } from './providers/youtube.service';

import { SportsProviderRateLimitService } from './services/sports-provider-rate-limit.service';

import { SupportedCompetitionService } from './services/supported-competition.service';

import { ActiveCompetitionService } from './services/active-competition.service';

import { ApiFootballActiveCompetitionService } from './services/api-football-active-competition.service';

import { ApiFootballQueueService } from './services/api-football-queue.service';

import { ApiFootballQueueBuilderService } from './services/api-football-queue-builder.service';

import { SportsCollectionService } from './services/sports-collection.service';

import { SportsDataReadService } from './services/sports-data-read.service';

import { SportsStartupService } from './services/sports-startup.service';

import { TeamCompetitionStatsService } from './services/team-competition-stats.service';

import { HeadToHeadService } from './services/head-to-head.service';

import { YoutubeHighlightService } from './services/youtube-highlight.service';

import { ApiFootballScheduler } from './schedulers/api-football.scheduler';

import { FootballDataScheduler } from './schedulers/football-data.scheduler';

import { OddsApiScheduler } from './schedulers/odds-api.scheduler';

import { YoutubeScheduler } from './schedulers/youtube.scheduler';

@Module({
  imports: [
    ScheduleModule.forRoot(),

    MongooseModule.forFeature([
      {
        name: ActiveCompetition.name,
        schema: ActiveCompetitionSchema,
      },
      {
        name: ApiFootballQueue.name,
        schema: ApiFootballQueueSchema,
      },
      {
        name: ApiFootballFixture.name,
        schema: ApiFootballFixtureSchema,
      },
      {
        name: ApiFootballStanding.name,
        schema: ApiFootballStandingSchema,
      },
      {
        name: FootballDataCompetition.name,
        schema: FootballDataCompetitionSchema,
      },
      {
        name: FootballDataMatch.name,
        schema: FootballDataMatchSchema,
      },
      {
        name: FootballDataStanding.name,
        schema: FootballDataStandingSchema,
      },
      {
        name: FootballDataTeam.name,
        schema: FootballDataTeamSchema,
      },
      {
        name: OddsApiSport.name,
        schema: OddsApiSportSchema,
      },
      {
        name: SportsOddsSnapshot.name,
        schema: SportsOddsSnapshotSchema,
      },
      {
        name: SportsProviderRateLimit.name,
        schema: SportsProviderRateLimitSchema,
      },
      {
        name: TeamCompetitionStats.name,
        schema: TeamCompetitionStatsSchema,
      },
      {
        name: HeadToHead.name,
        schema: HeadToHeadSchema,
      },
      {
        name: YouTubeHighlight.name,
        schema: YouTubeHighlightSchema,
      },
    ]),
  ],

  controllers: [SportsController],

  providers: [
    SportsService,

    // Provider clients
    ApiFootballService,
    FootballDataService,
    TheOddsApiService,
    YoutubeService,

    // Global provider throttling
    SportsProviderRateLimitService,

    // Competition registry
    SupportedCompetitionService,
    ActiveCompetitionService,
    ApiFootballActiveCompetitionService,

    // API-Football queue
    ApiFootballQueueService,
    ApiFootballQueueBuilderService,

    // Collection
    SportsCollectionService,

    // Derived data
    TeamCompetitionStatsService,
    HeadToHeadService,

    // YouTube
    YoutubeHighlightService,

    // Read layer
    SportsDataReadService,

    // Startup
    SportsStartupService,

    // Schedulers
    ApiFootballScheduler,
    FootballDataScheduler,
    OddsApiScheduler,
    YoutubeScheduler,
  ],

  exports: [
    SportsService,
    SportsDataReadService,
    ActiveCompetitionService,
    TeamCompetitionStatsService,
    HeadToHeadService,
  ],
})
export class SportsModule {}
