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

    const finalHome = this.readScore(fixture, true);

    const finalAway = this.readScore(fixture, false);

    if (finalHome === null || finalAway === null) {
      return null;
    }

    const halfTimeHome = this.readHalfTimeScore(fixture, true);

    const halfTimeAway = this.readHalfTimeScore(fixture, false);

    return {
      finalHomeScore: finalHome,
      finalAwayScore: finalAway,
      halfTimeHomeScore: halfTimeHome,
      halfTimeAwayScore: halfTimeAway,
    };
  }

  private static readScore(fixture: FixtureLike, home: boolean): number | null {
    const direct = home ? fixture.homeScore : fixture.awayScore;

    const value = this.toFiniteNumber(direct);

    if (value !== null) {
      return Math.max(Math.round(value), 0);
    }

    const nested = home ? fixture.home?.score : fixture.away?.score;

    const nestedValue = this.toFiniteNumber(nested);

    if (nestedValue !== null) {
      return Math.max(Math.round(nestedValue), 0);
    }

    const score = home ? fixture.scores?.home : fixture.scores?.away;

    const scoreValue = this.toFiniteNumber(this.getScoreValue(score));

    if (scoreValue !== null) {
      return Math.max(Math.round(scoreValue), 0);
    }

    const raw = fixture.raw;

    return this.findRawCompetitorScore(raw, home);
  }

  private static readHalfTimeScore(
    fixture: FixtureLike,
    home: boolean,
  ): number | null {
    const direct = home ? fixture.halfTimeHomeScore : fixture.halfTimeAwayScore;

    const directValue = this.toFiniteNumber(direct);

    if (directValue !== null) {
      return Math.max(Math.round(directValue), 0);
    }

    const nested = home
      ? (fixture.halfTime?.homeScore ?? fixture.ht?.homeScore)
      : (fixture.halfTime?.awayScore ?? fixture.ht?.awayScore);

    const nestedValue = this.toFiniteNumber(nested);

    if (nestedValue !== null) {
      return Math.max(Math.round(nestedValue), 0);
    }

    const raw = fixture.raw;

    if (!this.isRawFixtureLike(raw)) {
      return null;
    }

    const competitions = this.toArray<CompetitionLike>(raw.competitions);

    for (const competition of competitions) {
      const competitors = this.toArray<CompetitorLike>(competition.competitors);

      for (const competitor of competitors) {
        const isHome = competitor.homeAway === 'home';

        if (isHome !== home) {
          continue;
        }

        const lines = this.toArray<LineScoreLike>(competitor.linescores);

        if (lines.length < 1) {
          continue;
        }

        /*
         * Most ESPN soccer payloads expose period/linescore
         * information. We only use a half-time value when a
         * clearly identifiable period exists.
         */
        const firstPeriod = lines.find((line) => Number(line.period) === 1);

        const half = this.toFiniteNumber(
          firstPeriod?.value ?? firstPeriod?.displayValue,
        );

        if (half !== null) {
          return Math.max(Math.round(half), 0);
        }
      }
    }

    return null;
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

      const score = this.toFiniteNumber(competitor.score);

      if (score !== null) {
        return Math.max(Math.round(score), 0);
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

  private static toFiniteNumber(value: unknown): number | null {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return null;
    }

    return number;
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
