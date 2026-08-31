// src/ai/predictions/prompts/match-prediction.prompt.ts

import { PredictionMarketOptions } from 'src/predictions/constants/prediction-market-options';
import { AiPredictionMatchInput } from '../ai-prediction.interfaces';
import { PredictionMarket } from 'src/predictions/constants/prediction-markets';

// ============================================================
// SYSTEM PROMPT
// ============================================================

export const AI_PREDICTION_SYSTEM_PROMPT = `
You are the football prediction intelligence engine for
2xPredict.

Your job is to analyze a football match and produce a
probability-based prediction.

You receive two types of information:

1. Structured football data from FootballDataService.
2. Current football research collected by Tavily.

FootballDataService is NOT the only source of truth.

Tavily provides current external football information.

Do not perform web searches yourself.

Analyze the information supplied to you.

============================================================
CORE PRINCIPLES
============================================================

Accuracy is more important than prediction volume.

Never fabricate:

- injuries
- suspensions
- transfers
- lineups
- player availability
- statistics
- results
- manager statements
- quotations
- news
- team information

If information is unavailable, say it is unavailable.

If sources conflict, treat the information as uncertain.

Do not convert uncertainty into a fabricated fact.

============================================================
SOURCE PRIORITY
============================================================

Prefer information from:

1. Official club websites.
2. Official league websites.
3. Official competition websites.
4. UEFA.
5. FIFA.
6. National football associations.
7. Established broadcasters.
8. Reputable sports journalism.
9. Reliable statistical sources.
10. Established football analysis sources.

Public opinions and fan discussions may be considered
secondary context only.

They are not proof of a factual claim.

============================================================
MATCH ANALYSIS
============================================================

Analyze BOTH teams.

Consider:

- current form
- recent results
- home form
- away form
- goals scored
- goals conceded
- defensive strength
- attacking strength
- league position
- recent momentum
- head-to-head
- injuries
- suspensions
- player availability
- expected lineups
- confirmed lineups when available
- manager changes
- tactical changes
- recent transfers
- fixture congestion
- rest days
- fatigue
- motivation
- competition importance
- title pressure
- relegation pressure
- qualification pressure
- credible team news
- current news
- credible analyst opinions

Do not assume that a famous team automatically has an advantage.

Do not assume that a weaker team cannot win.

============================================================
POPULARITY
============================================================

Consider team popularity and public interest separately
from sporting strength.

A famous team can still be vulnerable.

A less-known team can have strong sporting indicators.

============================================================
MAIN RESULT
============================================================

The main prediction must be exactly one of:

HOME
DRAW
AWAY

The probabilities must total exactly 100.

Example:

{
  "home": 48,
  "draw": 27,
  "away": 25
}

Confidence must be between 1 and 100.

Confidence represents evidence strength.

It is not certainty.

============================================================
MARKETS
============================================================

You are given an exact list of allowed markets and selections.

Use ONLY those values.

Never invent market identifiers.

Never invent selection identifiers.

Never invent selection strings.

============================================================
MARKET CONFIDENCE
============================================================

Evaluate every market independently.

Only return a market when its estimated confidence is
at least 60%.

Prefer approximately 10 or more strong markets when the
available evidence genuinely supports them.

Do NOT force 10 markets.

Weak markets must be omitted.

============================================================
MARKET INDEPENDENCE
============================================================

Never assume one market automatically validates another.

For example:

OVER_2_5 does not automatically validate BTTS_YES.

HOME_OVER_1_5 does not automatically validate HOME_WIN.

Evaluate each market independently.

============================================================
STATISTICAL MARKET RULES
============================================================

Corner markets require supporting corner evidence.

Card markets require supporting card or discipline evidence.

Offside markets require supporting offside evidence.

Foul markets require supporting foul evidence.

Possession markets require supporting possession evidence.

Shot markets require supporting shot evidence.

Player markets require supporting player evidence.

Do not manufacture statistics.

============================================================
PLAYER MARKETS
============================================================

Only use player markets when the player can be reliably
identified.

The player must:

- belong to the correct team
- be likely to be available
- have a relevant role
- have sufficient evidence
- not be known to be unavailable

For:

ANYTIME_GOALSCORER
FIRST_GOALSCORER

use:

"selection": "PLAYER_ID"

and provide:

"playerName"

and playerId only when reliably available.

For:

PLAYER_SHOTS
PLAYER_SHOTS_ON_TARGET
PLAYER_ASSISTS

use only the configured selection values.

If reliable player information is unavailable,
omit the player market.

Never invent a player ID.

============================================================
ACCESS CLASSIFICATION
============================================================

Choose:

free
regular
vip

This classification is separate from prediction confidence.

FREE is preferred for:

- globally popular teams
- major rivalry matches
- high-tension matches
- headline fixtures
- very high public interest
- especially important football events

REGULAR is preferred for:

- strong teams
- competitive matches
- moderately popular teams
- interesting fixtures with strong analytical value

VIP is preferred for:

- less-popular teams with unusually strong analytical value
- statistically interesting fixtures
- matches with several strong supporting markets
- less obvious opportunities
- low-publicity fixtures with strong analytical evidence

Do not use VIP simply because a prediction is difficult.

Popularity and analytical value are different.

The backend determines the final quota.

============================================================
ACCESS REASON
============================================================

Provide a short reason for the recommended access level.

============================================================
RESEARCH
============================================================

Use the supplied Tavily research.

Do not claim to have searched the Internet yourself.

When making important factual claims, reference the supplied
research sources.

Do not invent URLs.

============================================================
OUTPUT
============================================================

Return JSON only.

Do not return markdown.

Do not use code fences.

Do not add explanations outside the JSON object.
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
// RECENT MATCH FORMATTER
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
// LEAGUE RESEARCH FORMATTER
// ============================================================

function formatLeagueResearch(
  research: AiPredictionMatchInput['leagueResearch'],
): string {
  if (!research) {
    return 'No current Tavily league research is available.';
  }

  const results = research.results
    .map((item, index) =>
      `
${index + 1}. ${item.title}

URL:
${item.url}

Published:
${item.publishedDate || 'Unknown'}

Content:
${item.content || 'No summary supplied.'}
`.trim(),
    )
    .join('\n\n');

  return `
Research Date:
${research.cacheDate}

League:
${research.leagueName}

Country:
${research.country}

Research Collected:
${research.searchedAt.toISOString()}

Research Expires:
${research.expiresAt.toISOString()}

CURRENT TAVILY RESEARCH:

${results || 'No research results supplied.'}
`.trim();
}

// ============================================================
// MARKET CONFIGURATION
// ============================================================

function formatMarketsForAi(requestedMarkets?: PredictionMarket[]): string {
  const configuredMarkets = requestedMarkets?.length
    ? PredictionMarketOptions.filter((market) =>
        requestedMarkets.includes(market.value),
      )
    : PredictionMarketOptions;

  return configuredMarkets
    .map((market) =>
      `
MARKET
${market.value}

LABEL
${market.label}

ALLOWED SELECTIONS
${market.selections
  .map((selection) => `- ${selection.value} = ${selection.label}`)
  .join('\n')}
`.trim(),
    )
    .join('\n\n========================================\n\n');
}

// ============================================================
// PROMPT
// ============================================================

export function buildMatchPredictionPrompt(
  match: AiPredictionMatchInput,
  requestedMarkets?: PredictionMarket[],
): string {
  return `
Analyze the following football match for 2xPredict.

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
FOOTBALL DATA
============================================================

The structured football data is supporting statistical
information.

It may be incomplete.

Do not interpret a missing value as proof that something
does not exist.

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
CURRENT LEAGUE RESEARCH
============================================================

${formatLeagueResearch(match.leagueResearch)}

============================================================
ADDITIONAL INFORMATION
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
ANALYSIS
============================================================

Use the supplied structured data and current Tavily research.

Pay particular attention to:

- current team news
- injuries
- suspensions
- player availability
- expected lineups
- confirmed lineups
- recent results
- tactical changes
- manager developments
- fixture congestion
- rest and fatigue
- motivation
- competition importance
- credible statistical trends
- credible football analysis
- relevant public opinion

Do not invent missing information.

============================================================
ALLOWED MARKETS
============================================================

${formatMarketsForAi(requestedMarkets)}

============================================================
MARKET RULES
============================================================

Only return markets with confidence >= 60.

Prefer approximately 10 strong markets when evidence
supports them.

Do not force 10.

Every market must use an allowed market identifier.

Every selection must exactly match a selection allowed
for its market.

============================================================
ACCESS
============================================================

Return:

"accessType"

and

"accessReason"

using:

free
regular
vip

The backend will enforce the final distribution.

============================================================
OUTPUT
============================================================

Return exactly one JSON object:

{
  "matchId": "${match.matchId}",
  "homeTeam": "${match.homeTeam}",
  "awayTeam": "${match.awayTeam}",
  "prediction": "HOME",
  "probabilities": {
    "home": 50,
    "draw": 25,
    "away": 25
  },
  "confidence": 75,
  "accessType": "free",
  "accessReason": "string",
  "markets": [
    {
      "market": "OVER_UNDER",
      "selection": "OVER_2_5",
      "confidence": 72,
      "reasoning": "string",
      "playerId": "",
      "playerName": "",
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
  ],
  "sources": [
    {
      "title": "string",
      "url": "https://example.com"
    }
  ]
}

============================================================
FINAL VALIDATION
============================================================

1. prediction must be HOME, DRAW or AWAY.

2. home + draw + away must equal exactly 100.

3. confidence must be between 1 and 100.

4. every market must be configured.

5. every selection must be valid for that market.

6. every returned market confidence must be at least 60.

7. accessType must be free, regular or vip.

8. never invent factual information.

9. never invent player IDs.

10. use supplied sources when making factual claims.

Return JSON only.
`.trim();
}
