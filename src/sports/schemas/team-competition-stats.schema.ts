import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { HydratedDocument } from 'mongoose';

export type TeamCompetitionStatsDocument =
  HydratedDocument<TeamCompetitionStats>;

@Schema({
  timestamps: true,
  collection: 'sports_team_competition_stats',
})
export class TeamCompetitionStats {
  /**
   * Our internal competition ID.
   */
  @Prop({
    required: true,
    index: true,
    trim: true,
    lowercase: true,
  })
  competitionId!: string;

  /**
   * Provider season year.
   */
  @Prop({
    required: true,
    index: true,
  })
  season!: number;

  /**
   * Team identity from the primary provider used for
   * this competition's statistical dataset.
   */
  @Prop({
    required: true,
    index: true,
  })
  teamId!: number;

  @Prop({
    required: true,
    trim: true,
  })
  teamName!: string;

  @Prop({
    type: String,
  })
  teamLogo?: string;

  // ==========================================================
  // TABLE
  // ==========================================================

  @Prop({
    type: Number,
  })
  position?: number;

  @Prop({
    type: Number,
    default: 0,
  })
  points!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  played!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  wins!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  draws!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  losses!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  goalsFor!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  goalsAgainst!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  goalDifference!: number;

  // ==========================================================
  // OVERALL
  // ==========================================================

  @Prop({
    type: Number,
    default: 0,
  })
  averageGoalsScored!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  averageGoalsConceded!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  winRate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  drawRate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  lossRate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  bttsRate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  over15Rate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  over25Rate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  over35Rate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  cleanSheetRate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  failedToScoreRate!: number;

  // ==========================================================
  // HOME
  // ==========================================================

  @Prop({
    type: Number,
    default: 0,
  })
  homePlayed!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  homeWins!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  homeDraws!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  homeLosses!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  homeGoalsFor!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  homeGoalsAgainst!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  homeAverageGoalsScored!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  homeAverageGoalsConceded!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  homeBttsRate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  homeOver15Rate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  homeOver25Rate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  homeOver35Rate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  homeCleanSheetRate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  homeFailedToScoreRate!: number;

  // ==========================================================
  // AWAY
  // ==========================================================

  @Prop({
    type: Number,
    default: 0,
  })
  awayPlayed!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayWins!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayDraws!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayLosses!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayGoalsFor!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayGoalsAgainst!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayAverageGoalsScored!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayAverageGoalsConceded!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayBttsRate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayOver15Rate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayOver25Rate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayOver35Rate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayCleanSheetRate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayFailedToScoreRate!: number;

  // ==========================================================
  // LAST FIVE
  // ==========================================================

  @Prop({
    type: [String],
    default: [],
  })
  lastFive!: string[];

  @Prop({
    type: [String],
    default: [],
  })
  lastFiveHome!: string[];

  @Prop({
    type: [String],
    default: [],
  })
  lastFiveAway!: string[];

  @Prop({
    type: Number,
    default: 0,
  })
  lastFivePoints!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  lastFiveGoalsScored!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  lastFiveGoalsConceded!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  lastFiveAverageGoalsScored!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  lastFiveAverageGoalsConceded!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  lastFiveBttsRate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  lastFiveOver25Rate!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  lastFiveCleanSheetRate!: number;

  // ==========================================================
  // FIXTURE CONTEXT
  // ==========================================================

  @Prop({
    type: Date,
  })
  previousMatchDate?: Date;

  @Prop({
    type: Number,
    default: 0,
  })
  daysSincePreviousMatch!: number;

  @Prop({
    type: Date,
  })
  nextMatchDate?: Date;

  @Prop({
    type: Number,
    default: 0,
  })
  daysUntilNextMatch!: number;

  // ==========================================================
  // DERIVED STRENGTH
  // ==========================================================

  @Prop({
    type: Number,
    default: 0,
  })
  recentFormScore!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  homeStrengthScore!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayStrengthScore!: number;

  @Prop({
    type: Number,
    default: 0,
  })
  overallStrengthScore!: number;

  @Prop({
    required: true,
    type: Date,
    index: true,
  })
  calculatedAt!: Date;
}

export const TeamCompetitionStatsSchema =
  SchemaFactory.createForClass(TeamCompetitionStats);

TeamCompetitionStatsSchema.index(
  {
    competitionId: 1,
    season: 1,
    teamId: 1,
  },
  {
    unique: true,
  },
);

TeamCompetitionStatsSchema.index({
  competitionId: 1,
  season: 1,
  position: 1,
});

TeamCompetitionStatsSchema.index({
  competitionId: 1,
  season: 1,
  overallStrengthScore: -1,
});

TeamCompetitionStatsSchema.index({
  teamId: 1,
  calculatedAt: -1,
});
