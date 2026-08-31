// src/ai/predictions/prompts/match-prediction.prompt.ts

import { PredictionMarket } from 'src/predictions/constants/prediction-markets';
import { AiPredictionMatchInput } from '../ai-prediction.interfaces';

// ============================================================
// SYSTEM PROMPT
// ============================================================

export const AI_PREDICTION_SYSTEM_PROMPT = `
You are the football prediction intelligence engine for
2xPredict.

Your job is to research and analyze football matches using
the supplied football data and current web information.

The football API data supplied to you is NOT the sole source
of truth.

You must independently verify important current information
using Google Search.

============================================================
FACTUAL ACCURACY
============================================================

Never invent:

- injuries
- suspensions
- transfers
- lineups
- player availability
- manager statements
- team news
- match results
- statistics
- player statistics
- quotations
- news stories

When information is unavailable or conflicting, say so.

============================================================
WEB RESEARCH
============================================================

When searching the web, prioritize:

1. Official club websites.
2. Official league or competition websites.
3. FIFA, UEFA and national football associations.
4. Established sports broadcasters.
5. Reputable football journalism organizations.
6. Reliable statistical websites.
7. Reputable match-analysis sources.

Use fan opinions and public opinions only as secondary evidence.

Do not treat social media opinions as factual evidence.

============================================================
MATCH RESEARCH
============================================================

Before producing the prediction, investigate when relevant:

- recent team news
- injuries
- suspensions
- expected lineups
- player availability
- confirmed lineups when already available
- recent team form
- home form
- away form
- scoring trends
- defensive trends
- head-to-head information
- manager changes
- tactical changes
- important transfers
- fixture congestion
- player fatigue
- motivation
- competition situation
- credible football analysis
- credible opinions from established football analysts

Do not assume that information from an old article is still
current.

Prefer recent information.

============================================================
PREDICTION RULE
============================================================

You are not predicting because a team is famous.

Use evidence.

A high probability does not mean certainty.

Football matches contain randomness.

============================================================
MARKET RULE
============================================================

Every market must be evaluated independently.

Only return a market when the available evidence supports
a confidence of at least 60%.

You should aim to identify at least 10 strong markets when
the evidence supports them.

It is acceptable to return fewer than 10 markets when fewer
than 10 genuinely reach the required threshold.

NEVER invent weak markets simply to reach 10.

============================================================
PLAYER MARKETS
============================================================

Only use player markets when current player availability
and relevant recent evidence can be established.

Never recommend an unavailable player.

============================================================
PROBABILITIES
============================================================

Home + Draw + Away must equal exactly 100.

Confidence must be between 1 and 100.

============================================================
SOURCE REQUIREMENT
============================================================

Important factual research findings should contain their
supporting source URLs.

============================================================
OUTPUT
============================================================

Return JSON only.

Do not return markdown.

Do not explain the JSON outside the JSON object.
`.trim();

// ============================================================
// TEAM FORMATTER
// ============================================================

function formatTeam(team: AiPredictionMatchInput['homeTeamData']): string {
  if (!team) {
    return 'No team statistics supplied.';
  }

  return `
Team:
${team.name}

League Position:
${team.position ?? 'Unknown'}

Points:
${team.points ?? 'Unknown'}

Played:
${team.playedGames ?? 'Unknown'}

Wins:
${team.won ?? 'Unknown'}

Draws:
${team.draw ?? 'Unknown'}

Losses:
${team.lost ?? 'Unknown'}

Goals For:
${team.goalsFor ?? 'Unknown'}

Goals Against:
${team.goalsAgainst ?? 'Unknown'}

Goal Difference:
${team.goalDifference ?? 'Unknown'}

Form:
${team.form || 'Unknown'}
`.trim();
}

// ============================================================
// MATCH FORMATTER
// ============================================================

function formatRecentMatches(
  matches: AiPredictionMatchInput['homeRecentMatches'],
): string {
  if (!matches?.length) {
    return 'No match data supplied.';
  }

  return matches
    .map((match, index) =>
      `
${index + 1}.
${match.homeTeam} ${match.homeScore ?? '-'} - ${match.awayScore ?? '-'} ${match.awayTeam}

Date:
${match.date}

Status:
${match.status || 'Unknown'}
`.trim(),
    )
    .join('\n\n');
}

// ============================================================
// MARKET LIST
// ============================================================

function formatMarkets(markets: PredictionMarket[]): string {
  return markets.map((market, index) => `${index + 1}. ${market}`).join('\n');
}

// ============================================================
// PROMPT
// ============================================================

export function buildMatchPredictionPrompt(
  match: AiPredictionMatchInput,
  requestedMarkets: PredictionMarket[] = [],
): string {
  const markets = requestedMarkets.length
    ? requestedMarkets
    : (Object.values(PredictionMarketsForPrompt) as PredictionMarket[]);

  return `
Research and analyze the following football match for
2xPredict.

============================================================
MATCH
============================================================

Match ID:
${match.matchId}

League:
${match.leagueName || match.leagueCode}

Country:
${match.country || 'Unknown'}

Home Team:
${match.homeTeam}

Away Team:
${match.awayTeam}

Match Date:
${match.matchDate}

Kickoff Timestamp:
${match.kickoffTimestamp}

Venue:
${match.venue || 'Unknown'}

Competition Stage:
${match.stage || 'Unknown'}

============================================================
FOOTBALL API DATA
============================================================

The supplied API data is a supporting source.

It may be incomplete.

Do not assume missing API data means something does not
exist in reality.

============================================================
HOME TEAM
============================================================

${formatTeam(match.homeTeamData)}

============================================================
AWAY TEAM
============================================================

${formatTeam(match.awayTeamData)}

============================================================
HOME RECENT MATCHES
============================================================

${formatRecentMatches(match.homeRecentMatches)}

============================================================
AWAY RECENT MATCHES
============================================================

${formatRecentMatches(match.awayRecentMatches)}

============================================================
HEAD TO HEAD
============================================================

${formatRecentMatches(match.headToHead)}

============================================================
ADDITIONAL NEWS
============================================================

${
  match.additionalNews?.length
    ? match.additionalNews.map((news) => `- ${news}`).join('\n')
    : 'No additional news supplied.'
}

============================================================
ADDITIONAL CONTEXT
============================================================

${match.additionalContext || 'None supplied.'}

============================================================
WEB RESEARCH
============================================================

Use Google Search to independently investigate this match.

Search for both teams separately.

Research:

1. Latest team news.
2. Current injuries.
3. Suspensions.
4. Player availability.
5. Expected lineups.
6. Confirmed lineups if available.
7. Recent results.
8. Home/away form.
9. Current tactical information.
10. Manager comments or changes.
11. Important recent transfers.
12. Fixture congestion.
13. Fatigue and rest.
14. Current competition motivation.
15. Current credible football analysis.
16. Reliable statistical information.
17. Credible opinions or analysis from established football
    sources.

Do not rely on a single website for important information
when the claim can reasonably be cross-checked.

Prioritize recent information.

============================================================
MARKETS
============================================================

Evaluate these markets:

${formatMarkets(markets)}

Do NOT force a prediction for every market.

Only return markets with at least 60% confidence.

Try to identify at least 10 strong markets when the available
evidence genuinely supports them.

If fewer than 10 markets reach 60%, return only the markets
that genuinely qualify.

============================================================
IMPORTANT MARKET RULE
============================================================

A confidence score is not a license to invent evidence.

For example:

If reliable corner statistics are unavailable, do not invent
a corner prediction.

If the likely starting striker cannot be established, do not
invent an anytime goalscorer prediction.

If card statistics are unavailable, do not fabricate card
probabilities.

============================================================
OUTPUT
============================================================

Return exactly this JSON structure:

{
  "matchId": "${match.matchId}",
  "homeTeam": "${match.homeTeam}",
  "awayTeam": "${match.awayTeam}",
  "prediction": "HOME",
  "probabilities": {
    "home": 0,
    "draw": 0,
    "away": 0
  },
  "confidence": 0,
  "markets": [
    {
      "market": "DOUBLE_CHANCE",
      "selection": "1X",
      "confidence": 0,
      "reasoning": "string",
      "supportingSources": [
        {
          "title": "string",
          "url": "https://example.com"
        }
      ]
    }
  ],
  "reasoning": [
    "string"
  ],
  "keyFactors": [
    "string"
  ],
  "risks": [
    "string"
  ],
  "recommendation": "string",
  "research": [
    {
      "topic": "Injuries",
      "finding": "string",
      "sources": [
        {
          "title": "string",
          "url": "https://example.com"
        }
      ]
    }
  ]
}

Prediction must be exactly:

HOME
DRAW
AWAY

Probabilities must total exactly 100.

Market confidence must be between 60 and 100.

Overall confidence must be between 1 and 100.

Return JSON only.
`.trim();
}

// ============================================================
// DEFAULT MARKET LIST
// ============================================================
//
// We keep this local so the prompt includes all supported
// markets without duplicating the actual enum values elsewhere.
// ============================================================

const PredictionMarketsForPrompt = {
  DOUBLE_CHANCE: 'DOUBLE_CHANCE',
  DRAW_NO_BET: 'DRAW_NO_BET',
  OVER_UNDER: 'OVER_UNDER',
  BOTH_TEAMS_TO_SCORE: 'BOTH_TEAMS_TO_SCORE',
  BTTS_GOALS: 'BTTS_GOALS',
  GOAL_RANGE: 'GOAL_RANGE',
  TEAM_TOTAL_GOALS: 'TEAM_TOTAL_GOALS',
  EXACT_GOALS: 'EXACT_GOALS',
  CLEAN_SHEET: 'CLEAN_SHEET',

  HALF_TIME_RESULT: 'HALF_TIME_RESULT',
  SECOND_HALF_RESULT: 'SECOND_HALF_RESULT',
  HALF_TIME_FULL_TIME: 'HALF_TIME_FULL_TIME',

  ASIAN_HANDICAP: 'ASIAN_HANDICAP',
  EUROPEAN_HANDICAP: 'EUROPEAN_HANDICAP',

  CORNERS_TOTAL: 'CORNERS_TOTAL',
  TEAM_CORNERS: 'TEAM_CORNERS',
  CORNER_HANDICAP: 'CORNER_HANDICAP',

  CARDS_TOTAL: 'CARDS_TOTAL',
  TEAM_CARDS: 'TEAM_CARDS',
  CARD_HANDICAP: 'CARD_HANDICAP',

  ANYTIME_GOALSCORER: 'ANYTIME_GOALSCORER',
  FIRST_GOALSCORER: 'FIRST_GOALSCORER',
  PLAYER_SHOTS: 'PLAYER_SHOTS',
  PLAYER_SHOTS_ON_TARGET: 'PLAYER_SHOTS_ON_TARGET',
  PLAYER_ASSISTS: 'PLAYER_ASSISTS',

  FIRST_GOAL: 'FIRST_GOAL',
  LAST_GOAL: 'LAST_GOAL',
  WIN_TO_NIL: 'WIN_TO_NIL',
  CORRECT_SCORE: 'CORRECT_SCORE',

  POSSESSION_WINNER: 'POSSESSION_WINNER',
  MOST_SHOTS: 'MOST_SHOTS',
  MOST_SHOTS_ON_TARGET: 'MOST_SHOTS_ON_TARGET',
  GOAL_TIMING: 'GOAL_TIMING',

  OFFSIDES_TOTAL: 'OFFSIDES_TOTAL',
  TEAM_OFFSIDES: 'TEAM_OFFSIDES',
  FOULS_TOTAL: 'FOULS_TOTAL',
  TEAM_FOULS: 'TEAM_FOULS',

  FIRST_HALF_GOALS: 'FIRST_HALF_GOALS',
  SECOND_HALF_GOALS: 'SECOND_HALF_GOALS',
  FIRST_HALF_CORNERS: 'FIRST_HALF_CORNERS',
  FIRST_HALF_CARDS: 'FIRST_HALF_CARDS',
} as const;
