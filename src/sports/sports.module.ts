import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SportsController } from './sports.controller';

import { SportsService } from './sports.service';

import { EspnService } from './providers/espn.service';
import { FootballDataService } from './providers/football-data.service';
import { TheOddsApiService } from './providers/the-odds-api.service';
import { YoutubeService } from './providers/youtube.service';

import { SportsProviderRateLimitService } from './services/sports-provider-rate-limit.service';

import { PriorityCompetitionService } from './services/priority-competition.service';
import { ActiveCompetitionService } from './services/active-competition.service';
import { EspnActiveCompetitionService } from './services/espn-active-competition.service';

import { EspnQueueService } from './services/espn-queue.service';
import { EspnQueueBuilderService } from './services/espn-queue-builder.service';
import { EspnQueueWorkerService } from './services/espn-queue-worker.service';

import { SportsCollectionService } from './services/sports-collection.service';
import { SportsDataReadService } from './services/sports-data-read.service';

import { SportsStartupService } from './services/sports-startup.service';

import { TeamCompetitionStatsService } from './services/team-competition-stats.service';
import { TeamPerformanceProfileService } from './services/team-performance-profile.service';
import { HeadToHeadService } from './services/head-to-head.service';

import { YoutubeHighlightService } from './services/youtube-highlight.service';

import { FootballDataScheduler } from './schedulers/football-data.scheduler';
import { NewsScheduler } from './schedulers/news.scheduler';

import {
  ActiveCompetition,
  ActiveCompetitionSchema,
} from './schemas/active-competition.schema';

import {
  EspnLeague,
  EspnLeagueSchema,
} from './schemas/espn/espn-league.schema';

import {
  EspnFixture,
  EspnFixtureSchema,
} from './schemas/espn/espn-fixture.schema';

import {
  EspnLiveMatch,
  EspnLiveMatchSchema,
} from './schemas/espn/espn-livematch.schema';

import {
  EspnMatchEvent,
  EspnMatchEventSchema,
} from './schemas/espn/espn-match-event.schema';

import {
  EspnMatchStatistics,
  EspnMatchStatisticsSchema,
} from './schemas/espn/espn-match-statistics.schema';

import { EspnNews, EspnNewsSchema } from './schemas/espn/espn-news.schema';

import { EspnOdds, EspnOddsSchema } from './schemas/espn/espn-odds.schema';

import {
  EspnStanding,
  EspnStandingSchema,
} from './schemas/espn/espn-standing.schema';

import { EspnTeam, EspnTeamSchema } from './schemas/espn/espn-team.schema';

import { EspnQueue, EspnQueueSchema } from './schemas/espn-queue.schema';

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

import {
  TeamPerformanceProfile,
  TeamPerformanceProfileSchema,
} from './schemas/team-performance-profile.schema';

import { HeadToHead, HeadToHeadSchema } from './schemas/head-to-head.schema';

import {
  YouTubeHighlight,
  YouTubeHighlightSchema,
} from './schemas/youtube-highlight.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: ActiveCompetition.name,
        schema: ActiveCompetitionSchema,
      },

      {
        name: EspnLeague.name,
        schema: EspnLeagueSchema,
      },

      {
        name: EspnFixture.name,
        schema: EspnFixtureSchema,
      },

      {
        name: EspnLiveMatch.name,
        schema: EspnLiveMatchSchema,
      },

      {
        name: EspnMatchEvent.name,
        schema: EspnMatchEventSchema,
      },

      {
        name: EspnMatchStatistics.name,
        schema: EspnMatchStatisticsSchema,
      },

      {
        name: EspnNews.name,
        schema: EspnNewsSchema,
      },

      {
        name: EspnOdds.name,
        schema: EspnOddsSchema,
      },

      {
        name: EspnStanding.name,
        schema: EspnStandingSchema,
      },

      {
        name: EspnTeam.name,
        schema: EspnTeamSchema,
      },

      {
        name: EspnQueue.name,
        schema: EspnQueueSchema,
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
        name: TeamPerformanceProfile.name,
        schema: TeamPerformanceProfileSchema,
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

    // ESPN
    EspnService,
    EspnActiveCompetitionService,

    // Other independent providers
    FootballDataService,
    TheOddsApiService,
    YoutubeService,

    // Global provider rate limiting
    SportsProviderRateLimitService,

    // Competition registry
    PriorityCompetitionService,
    ActiveCompetitionService,

    // ESPN queue
    EspnQueueService,
    EspnQueueBuilderService,
    EspnQueueWorkerService,

    // Collection / read
    SportsCollectionService,
    SportsDataReadService,

    // Derived data
    TeamCompetitionStatsService,
    TeamPerformanceProfileService,
    HeadToHeadService,

    // YouTube lifecycle
    YoutubeHighlightService,

    // Startup
    SportsStartupService,

    // Remaining scheduled providers
    FootballDataScheduler,
    NewsScheduler,
  ],

  exports: [
    SportsService,
    SportsDataReadService,
    ActiveCompetitionService,
    EspnService,
    TeamCompetitionStatsService,
    TeamPerformanceProfileService,
    HeadToHeadService,
  ],
})
export class SportsModule {}
