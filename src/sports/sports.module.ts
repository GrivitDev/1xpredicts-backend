import { Module } from '@nestjs/common';

import { MongooseModule } from '@nestjs/mongoose';

import { SportsController } from './sports.controller';

import { SportsService } from './sports.service';

import { SportsCacheModule } from './cache/sports-cache.module';

import { ApiFootballService } from './providers/api-football.service';

import { FootballDataService } from './providers/football-data.service';

import { TheOddsApiService } from './providers/the-odds-api.service';

import { TheSportsDbService } from './providers/thesportsdb.service';

import { YoutubeService } from './providers/youtube.service';

import {
  ActiveCompetition,
  ActiveCompetitionSchema,
} from './schemas/active-competition.schema';

import {
  ApiFootballQueue,
  ApiFootballQueueSchema,
} from './schemas/api-football-queue.schema';

import {
  SportsOddsSnapshot,
  SportsOddsSnapshotSchema,
} from './schemas/sports-odds-snapshot.schema';

import {
  YoutubeHighlight,
  YoutubeHighlightSchema,
} from './schemas/youtube-highlight.schema';

import {
  ApiFootballFixture,
  ApiFootballFixtureSchema,
} from './schemas/api-football/api-football-fixture.schema';

import {
  ApiFootballStanding,
  ApiFootballStandingSchema,
} from './schemas/api-football/api-football-standing.schema';

import {
  ApiFootballTeamStatistics,
  ApiFootballTeamStatisticsSchema,
} from './schemas/api-football/api-football-team-statistics.schema';

import {
  ApiFootballInjury,
  ApiFootballInjurySchema,
} from './schemas/api-football/api-football-injury.schema';

import {
  ApiFootballPrediction,
  ApiFootballPredictionSchema,
} from './schemas/api-football/api-football-prediction.schema';

import {
  TheSportsDbSeason,
  TheSportsDbSeasonSchema,
} from './schemas/thesportsdb/thesportsdb-season.schema';

import {
  TheSportsDbEvent,
  TheSportsDbEventSchema,
} from './schemas/thesportsdb/thesportsdb-event.schema';

import {
  TheSportsDbEventResult,
  TheSportsDbEventResultSchema,
} from './schemas/thesportsdb/thesportsdb-event-result.schema';

import {
  TheSportsDbTimeline,
  TheSportsDbTimelineSchema,
} from './schemas/thesportsdb/thesportsdb-timeline.schema';

import {
  TheSportsDbLineup,
  TheSportsDbLineupSchema,
} from './schemas/thesportsdb/thesportsdb-lineup.schema';

import {
  TheSportsDbStatistics,
  TheSportsDbStatisticsSchema,
} from './schemas/thesportsdb/thesportsdb-statistics.schema';

import {
  TheSportsDbTeam,
  TheSportsDbTeamSchema,
} from './schemas/thesportsdb/thesportsdb-team.schema';

import {
  TheSportsDbPlayer,
  TheSportsDbPlayerSchema,
} from './schemas/thesportsdb/thesportsdb-player.schema';

import {
  TheSportsDbPlayerStatistics,
  TheSportsDbPlayerStatisticsSchema,
} from './schemas/thesportsdb/thesportsdb-player-statistics.schema';

import {
  TheSportsDbVenue,
  TheSportsDbVenueSchema,
} from './schemas/thesportsdb/thesportsdb-venue.schema';

import {
  OddsApiSport,
  OddsApiSportSchema,
} from './schemas/odds-api-sport.schema';

import {
  OddsApiEvent,
  OddsApiEventSchema,
} from './schemas/odds-api-event.schema';

import {
  OddsApiScore,
  OddsApiScoreSchema,
} from './schemas/odds-api-score.schema';

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

import { ActiveCompetitionService } from './services/active-competition.service';

import { ApiFootballActiveCompetitionService } from './services/api-football-active-competition.service';

import { ApiFootballQueueService } from './services/api-football-queue.service';

import { ApiFootballQueueBuilderService } from './services/api-football-queue-builder.service';

import { SportsCacheReadService } from './services/sports-cache-read.service';

import { SportsCacheWriteService } from './services/sports-cache-write.service';

import { SportsCollectionService } from './services/sports-collection.service';

import { SportsDataReadService } from './services/sports-data-read.service';

import { SportsProviderRateLimitService } from './services/sports-provider-rate-limit.service';

import { SupportedCompetitionService } from './services/supported-competition.service';

import { YoutubeHighlightService } from './services/youtube-highlight.service';

import { SportsStartupService } from './services/sports-startup.service';

import { ApiFootballScheduler } from './schedulers/api-football.scheduler';

import { OddsApiScheduler } from './schedulers/odds-api.scheduler';

import { FootballDataScheduler } from './schedulers/football-data.scheduler';

import { ThesportsdbScheduler } from './schedulers/thesportsdb.scheduler';

import { YoutubeScheduler } from './schedulers/youtube.scheduler';

@Module({
  imports: [
    SportsCacheModule,

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
        name: SportsOddsSnapshot.name,
        schema: SportsOddsSnapshotSchema,
      },

      {
        name: YoutubeHighlight.name,
        schema: YoutubeHighlightSchema,
      },

      // Football-Data
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

      // API-Football
      {
        name: ApiFootballFixture.name,
        schema: ApiFootballFixtureSchema,
      },

      {
        name: ApiFootballStanding.name,
        schema: ApiFootballStandingSchema,
      },

      {
        name: ApiFootballTeamStatistics.name,
        schema: ApiFootballTeamStatisticsSchema,
      },

      {
        name: ApiFootballInjury.name,
        schema: ApiFootballInjurySchema,
      },

      {
        name: ApiFootballPrediction.name,
        schema: ApiFootballPredictionSchema,
      },

      // TheSportsDB
      {
        name: TheSportsDbSeason.name,
        schema: TheSportsDbSeasonSchema,
      },

      {
        name: TheSportsDbEvent.name,
        schema: TheSportsDbEventSchema,
      },

      {
        name: TheSportsDbEventResult.name,
        schema: TheSportsDbEventResultSchema,
      },

      {
        name: TheSportsDbTimeline.name,
        schema: TheSportsDbTimelineSchema,
      },

      {
        name: TheSportsDbLineup.name,
        schema: TheSportsDbLineupSchema,
      },

      {
        name: TheSportsDbStatistics.name,
        schema: TheSportsDbStatisticsSchema,
      },

      {
        name: TheSportsDbTeam.name,
        schema: TheSportsDbTeamSchema,
      },

      {
        name: TheSportsDbPlayer.name,
        schema: TheSportsDbPlayerSchema,
      },

      {
        name: TheSportsDbPlayerStatistics.name,
        schema: TheSportsDbPlayerStatisticsSchema,
      },

      {
        name: TheSportsDbVenue.name,
        schema: TheSportsDbVenueSchema,
      },

      // The Odds API
      {
        name: OddsApiSport.name,
        schema: OddsApiSportSchema,
      },

      {
        name: OddsApiEvent.name,
        schema: OddsApiEventSchema,
      },

      {
        name: OddsApiScore.name,
        schema: OddsApiScoreSchema,
      },
    ]),
  ],

  controllers: [SportsController],

  providers: [
    // Public facade
    SportsService,

    // Providers
    ApiFootballService,
    FootballDataService,
    TheSportsDbService,
    TheOddsApiService,
    YoutubeService,

    // Provider rate limiting
    SportsProviderRateLimitService,

    // Competition
    SupportedCompetitionService,
    ActiveCompetitionService,
    ApiFootballActiveCompetitionService,

    // API-Football queue
    ApiFootballQueueService,
    ApiFootballQueueBuilderService,

    // Cache / collection / reads
    SportsCacheReadService,
    SportsCacheWriteService,
    SportsCollectionService,
    SportsDataReadService,

    // YouTube
    YoutubeHighlightService,

    // Startup
    SportsStartupService,

    // Provider schedulers
    ApiFootballScheduler,
    OddsApiScheduler,
    FootballDataScheduler,
    ThesportsdbScheduler,
    YoutubeScheduler,
  ],

  exports: [
    SportsService,
    SupportedCompetitionService,
    ActiveCompetitionService,
    SportsDataReadService,
    SportsCollectionService,
    ApiFootballService,
    FootballDataService,
    TheOddsApiService,
    TheSportsDbService,
    YoutubeService,
  ],
})
export class SportsModule {}
