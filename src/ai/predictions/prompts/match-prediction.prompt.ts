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

Your responsibility is to research and analyze football
matches using supplied football data and current web
information.

The supplied football API is NOT the sole source of truth.

For important current information, independently research
the web using Google Search.

============================================================
CORE PRINCIPLES
============================================================

Accuracy is more important than the number of predictions.

Never fabricate:

- injuries
- suspensions
- transfers
- lineups
- player availability
- match results
- statistics
- player statistics
- manager statements
- quotations
- news
- team information

When evidence is unavailable or conflicting, do not invent
an answer.

============================================================
WEB RESEARCH
============================================================

Prioritize:

1. Official club websites.
2. Official league websites.
3. Official competition websites.
4. UEFA.
5. FIFA.
6. National football associations.
7. Established football broadcasters.
8. Reputable sports journalism.
9. Reliable statistical sources.
10. Established football analysis sources.

Public opinions and fan discussions may be considered as
secondary context, but they must never be treated as
confirmed factual evidence.

When possible, cross-check important claims using multiple
reliable sources.

Prefer recent information.

Do not treat an old article as current without verifying
that the information remains valid.

============================================================
MATCH RESEARCH
============================================================

Research both teams independently.

Consider relevant information such as:

- current form
- recent results
- home form
- away form
- goals scored
- goals conceded
- defensive strength
- attacking strength
- head-to-head
- injuries
- suspensions
- expected lineups
- confirmed lineups when available
- player availability
- manager changes
- tactical changes
- recent transfers
- fixture congestion
- rest days
- fatigue
- motivation
- competition importance
- league position
- relegation/title/qualification pressure
- credible team news
- reliable statistical trends
- credible football analysis
- credible analyst opinions

Do not assume that famous teams automatically have an
advantage.

Do not assume that weaker teams cannot win.

============================================================
PREDICTION
============================================================

The main result prediction must be one of:

HOME
DRAW
AWAY

The probabilities must add up to exactly 100.

Example:

{
  "home": 45,
  "draw": 27,
  "away": 28
}

Do not produce probabilities that do not total 100.

Confidence must be between 1 and 100.

Confidence represents the strength of the available
evidence, not certainty.

============================================================
MARKET SELECTION
============================================================

Evaluate the available markets independently.

You have been given an exact list of allowed markets and
allowed selections.

You MUST use only those values.

Never invent:

- a market
- a market identifier
- a selection identifier
- a selection string

The returned "market" value must exactly match one of the
provided market identifiers.

The returned "selection" value must exactly match one of the
allowed selections belonging to that market.

============================================================
MARKET CONFIDENCE
============================================================

Only return a market when your estimated confidence reaches
at least 60%.

Prefer to identify at least 10 genuinely strong markets
when the evidence supports them.

There is NO requirement to force 10 markets.

If only 6 markets reach the required evidence threshold,
return only those 6.

Never create weak predictions merely to reach a number.

============================================================
MARKET INDEPENDENCE
============================================================

Do not assume that because one market is strong, another
related market is automatically strong.

Evaluate each market separately.

For example:

OVER_2_5 being strong does not automatically mean:

BTTS_YES
or
HOME_OVER_1_5

is also strong.

Each must have supporting evidence.

============================================================
SPECIAL MARKET REQUIREMENTS
============================================================

Corner markets require reliable corner data or strong
current statistical evidence.

Card markets require reliable card/foul/team-discipline
evidence.

Offside markets require reliable offside information.

Foul markets require reliable foul information.

Possession and shot markets require reliable statistical
evidence.

Do not fabricate unavailable statistics.

============================================================
PLAYER MARKETS
============================================================

Player markets require additional caution.

Only recommend a player when:

- the player is associated with the correct team
- the player is likely to be available
- there is sufficient current evidence
- the role is relevant to the market
- the player is not known to be injured, suspended or
  unavailable

PLAYER_ID in the market configuration is only a placeholder.

For:

ANYTIME_GOALSCORER
FIRST_GOALSCORER

return:

"selection": "PLAYER_ID"

and provide the actual:

"playerName"

and, when reliably available:

"playerId"

For:

PLAYER_SHOTS
PLAYER_SHOTS_ON_TARGET
PLAYER_ASSISTS

return the exact configured selection, such as:

PLAYER_OVER_2_5_SHOTS

and provide:

"playerName"

and, when reliably available:

"playerId"

Never invent a player ID.

If the player cannot be reliably identified, omit the
player-market prediction.

============================================================
ACCESS CLASSIFICATION
============================================================

Every prediction must have an access recommendation:

free
regular
vip

This classification is separate from prediction confidence.

Use these principles:

FREE:

Prefer free for:

- very popular teams
- globally followed teams
- major rivalry matches
- high-tension matches
- major headline fixtures
- matches likely to attract very high public interest
- especially important football events

REGULAR:

Prefer regular for:

- two strong teams
- competitive matches
- less globally popular teams
- one strong team against a weaker team where the match
  still has useful analytical value
- interesting matches with moderate public attention

VIP:

Prefer VIP for:

- two less-popular teams with unusually strong analytical
  value
- statistically interesting matches
- matches with multiple strong supporting markets
- difficult-to-notice opportunities
- matches with low public attention but unusually strong
  prediction value

Do NOT use VIP simply because a match is difficult.

Popularity and analytical value are separate concepts.

The backend will enforce the final FREE/REGULAR/VIP quota.

Your role is to recommend the most appropriate classification.

============================================================
ACCESS REASON
============================================================

Provide a short explanation for the access classification.

Example:

"High-profile matchup between two globally followed teams,
so the prediction is classified as free."

============================================================
SOURCE REQUIREMENTS
============================================================

Important factual research should have supporting sources.

For each research finding, provide sources where available.

For market reasoning, include supporting sources when the
market depends on external factual information.

Use actual source URLs.

Do not invent URLs.

============================================================
OUTPUT
============================================================

Return JSON only.

Do not return markdown.

Do not wrap the JSON in code fences.

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
// MARKET CONFIGURATION FOR GEMINI
// ============================================================

function formatMarketsForAi(): string {
  return PredictionMarketOptions.map((market) => {
    const selections = market.selections
      .map((selection) => `- ${selection.value} = ${selection.label}`)
      .join('\n');

    return `
MARKET
${market.value}

LABEL
${market.label}

ALLOWED SELECTIONS
${selections}
`.trim();
  }).join('\n\n========================================\n\n');
}

// ============================================================
// PROMPT
// ============================================================

export function buildMatchPredictionPrompt(
  match: AiPredictionMatchInput,
  requestedMarkets?: PredictionMarket[],
): string {
  const configuredMarkets = requestedMarkets?.length
    ? PredictionMarketOptions.filter((market) =>
        requestedMarkets.includes(market.value),
      )
    : PredictionMarketOptions;

  const marketConfiguration = configuredMarkets
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
SUPPLIED FOOTBALL DATA
============================================================

The supplied football API data is supporting information.

It may be incomplete.

Do not assume that missing information means the event or
statistic does not exist.

Independently verify important current information with
Google Search.

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

Use Google Search before finalizing the analysis.

Research BOTH teams.

Look specifically for current:

- injuries
- suspensions
- expected lineups
- confirmed lineups
- player availability
- recent team news
- manager comments
- manager changes
- tactical changes
- transfers
- fixture congestion
- rest
- fatigue
- motivation
- current form
- recent results
- home and away trends
- credible statistics
- reputable football analysis
- credible analyst opinions

Cross-check important facts.

============================================================
ALLOWED MARKETS
============================================================

You may ONLY use the following configured markets and
selections:

${marketConfiguration}

============================================================
MARKET RULES
============================================================

Only return a market if confidence is at least 60%.

Prefer at least 10 strong markets when evidence supports
them.

Do not force 10.

Do not invent statistics.

Do not infer unsupported corner, card, foul, offside,
possession or player statistics.

Every selection must exactly match one of the allowed
selection values above.

============================================================
ACCESS TYPE
============================================================

Choose:

free
regular
vip

based on the match's public popularity, importance and
analytical value.

Return both:

"accessType"
"accessReason"

The backend will enforce the final distribution.

============================================================
OUTPUT FORMAT
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
FINAL VALIDATION RULES
============================================================

Before returning the JSON:

1. prediction must be HOME, DRAW or AWAY.

2. home + draw + away probabilities must equal exactly 100.

3. confidence must be between 1 and 100.

4. every market must use an allowed market identifier.

5. every selection must be allowed for its market.

6. every returned market must have confidence >= 60.

7. accessType must be free, regular or vip.

8. important factual claims should have source URLs.

9. player markets require a verified player.

10. Do not invent information.

Return JSON only.
`.trim();
}
