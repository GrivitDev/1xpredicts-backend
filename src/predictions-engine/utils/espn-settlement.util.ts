// src/predictions-engine/utils/espn-settlement.util.ts

import { EspnSettlementScore } from '../interfaces/espn-settlement-score.interface';

interface LineScoreLike {
  period?: unknown;
  value?: unknown;
  displayValue?: unknown;
}

interface CompetitorLike {
  homeAway?: unknown;
  score?: unknown;
  linescores?: unknown;
}

interface CompetitionLike {
  competitors?: unknown;
}

interface RawFixtureLike {
  competitions?: unknown;
}

interface FixtureLike {
  homeScore?: unknown;
  awayScore?: unknown;

  home?: {
    score?: unknown;
  };

  away?: {
    score?: unknown;
  };

  scores?: {
    home?: unknown;
    away?: unknown;
  };

  halfTimeHomeScore?: unknown;
  halfTimeAwayScore?: unknown;

  halfTime?: {
    homeScore?: unknown;
    awayScore?: unknown;
  };

  ht?: {
    homeScore?: unknown;
    awayScore?: unknown;
  };

  raw?: unknown;
}

export class EspnSettlementUtil {
  static extract(fixture: unknown): EspnSettlementScore | null {
    if (!this.isFixtureLike(fixture)) {
      return null;
    }

    const finalHomeScore = this.readScore(fixture, true);
    const finalAwayScore = this.readScore(fixture, false);

    if (finalHomeScore === null || finalAwayScore === null) {
      return null;
    }

    return {
      finalHomeScore,
      finalAwayScore,
      halfTimeHomeScore: this.readHalfTimeScore(fixture, true),
      halfTimeAwayScore: this.readHalfTimeScore(fixture, false),
    };
  }

  private static readScore(fixture: FixtureLike, home: boolean): number | null {
    const directScore = home ? fixture.homeScore : fixture.awayScore;

    const directValue = this.toNonNegativeInteger(directScore);

    if (directValue !== null) {
      return directValue;
    }

    const nestedScore = home ? fixture.home?.score : fixture.away?.score;

    const nestedValue = this.toNonNegativeInteger(nestedScore);

    if (nestedValue !== null) {
      return nestedValue;
    }

    const score = home ? fixture.scores?.home : fixture.scores?.away;

    const scoreValue = this.toNonNegativeInteger(this.getScoreValue(score));

    if (scoreValue !== null) {
      return scoreValue;
    }

    return this.findRawCompetitorScore(fixture.raw, home);
  }

  private static readHalfTimeScore(
    fixture: FixtureLike,
    home: boolean,
  ): number | null {
    const directScore = home
      ? fixture.halfTimeHomeScore
      : fixture.halfTimeAwayScore;

    const directValue = this.toNonNegativeInteger(directScore);

    if (directValue !== null) {
      return directValue;
    }

    const nestedScore = home
      ? (fixture.halfTime?.homeScore ?? fixture.ht?.homeScore)
      : (fixture.halfTime?.awayScore ?? fixture.ht?.awayScore);

    const nestedValue = this.toNonNegativeInteger(nestedScore);

    if (nestedValue !== null) {
      return nestedValue;
    }

    return this.findRawCompetitorHalfTimeScore(fixture.raw, home);
  }

  private static findRawCompetitorScore(
    raw: unknown,
    home: boolean,
  ): number | null {
    if (!this.isRawFixtureLike(raw)) {
      return null;
    }

    const competitions = this.toArray<CompetitionLike>(raw.competitions);

    for (const competition of competitions) {
      const competitors = this.toArray<CompetitorLike>(competition.competitors);

      const competitor = competitors.find(
        (item) => item.homeAway === (home ? 'home' : 'away'),
      );

      if (!competitor) {
        continue;
      }

      const score = this.toNonNegativeInteger(
        this.getScoreValue(competitor.score),
      );

      if (score !== null) {
        return score;
      }
    }

    return null;
  }

  private static findRawCompetitorHalfTimeScore(
    raw: unknown,
    home: boolean,
  ): number | null {
    if (!this.isRawFixtureLike(raw)) {
      return null;
    }

    const competitions = this.toArray<CompetitionLike>(raw.competitions);

    for (const competition of competitions) {
      const competitors = this.toArray<CompetitorLike>(competition.competitors);

      const competitor = competitors.find(
        (item) => item.homeAway === (home ? 'home' : 'away'),
      );

      if (!competitor) {
        continue;
      }

      const lines = this.toArray<LineScoreLike>(competitor.linescores);

      if (lines.length === 0) {
        continue;
      }

      const firstPeriod = lines.find((line) => Number(line.period) === 1);

      const halfTimeScore = this.toNonNegativeInteger(
        firstPeriod?.value ?? firstPeriod?.displayValue,
      );

      if (halfTimeScore !== null) {
        return halfTimeScore;
      }
    }

    return null;
  }

  private static getScoreValue(value: unknown): unknown {
    if (!this.isRecord(value)) {
      return value;
    }

    return value.value ?? value.displayValue;
  }

  private static toNonNegativeInteger(value: unknown): number | null {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return null;
    }

    if (number < 0) {
      return null;
    }

    return Math.round(number);
  }

  private static toArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }

  private static isFixtureLike(value: unknown): value is FixtureLike {
    return this.isRecord(value);
  }

  private static isRawFixtureLike(value: unknown): value is RawFixtureLike {
    return this.isRecord(value);
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
