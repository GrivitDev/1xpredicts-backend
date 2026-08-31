import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { GeminiService } from '../gemini/gemini.service';

import { PredictionsService } from '../../predictions/predictions.service';

import { AiCommunityDiscussionResult } from './ai-community-discussion.interfaces';

import { CommunityPostType } from '../../community/enums/community-post-type.enum';

@Injectable()
export class AiCommunityDiscussionService {
  private readonly logger = new Logger(AiCommunityDiscussionService.name);

  constructor(
    private readonly geminiService: GeminiService,

    private readonly predictionsService: PredictionsService,
  ) {}

  // ==========================================================
  // GENERATE
  // ==========================================================

  async generateDiscussion(
    context?: string,
  ): Promise<AiCommunityDiscussionResult> {
    const predictions =
      await this.predictionsService.findUpcomingPredictionsForDiscussion();

    const selectedPrediction = this.selectPrediction(predictions);

    const result =
      await this.geminiService.generateJson<AiCommunityDiscussionResult>({
        task: 'community_discussion',

        prompt: this.buildPrompt(selectedPrediction, context),

        options: {
          temperature: 0.7,

          maxOutputTokens: 1800,

          useGoogleSearch: true,

          systemInstruction: this.getSystemInstruction(),
        },
      });

    if (!result.data) {
      throw new BadRequestException('Gemini returned no discussion');
    }

    const discussion = this.validateDiscussion(result.data);

    return {
      ...discussion,

      sources: this.normalizeSources([
        ...(result.sources || []),
        ...discussion.sources,
      ]),
    };
  }

  // ==========================================================
  // SELECT
  // ==========================================================

  private selectPrediction(predictions: any[]) {
    if (!Array.isArray(predictions) || predictions.length === 0) {
      return null;
    }

    return predictions[0];
  }

  // ==========================================================
  // PROMPT
  // ==========================================================

  private buildPrompt(prediction: any, context?: string): string {
    if (!prediction) {
      return `
Create one short football community discussion for 2xPredict.

There is currently no upcoming 2xPredict prediction available.

Use Google Search to find an important football match or
team situation happening today or within the next few days.

Create a genuine football argument.

${context || ''}

Use short sentences.

Do not write an article.

Return JSON only:

{
  "type": "discussion",
  "title": "string",
  "message": "string",
  "category": "Football Discussion",
  "sources": [
    {
      "title": "string",
      "url": "https://example.com"
    }
  ]
}
      `.trim();
    }

    return `
Create one short football community discussion for 2xPredict.

============================================================
2XPREDICT PREDICTION
============================================================

Match:
${prediction.homeTeam} vs ${prediction.awayTeam}

League:
${prediction.league?.name || prediction.leagueCode}

Match Date:
${prediction.matchDate}

Prediction:
${prediction.prediction}

Probabilities:
Home: ${prediction.probabilities?.home ?? 'Unknown'}%
Draw: ${prediction.probabilities?.draw ?? 'Unknown'}%
Away: ${prediction.probabilities?.away ?? 'Unknown'}%

Confidence:
${prediction.confidence ?? 'Unknown'}%

Markets:
${
  Array.isArray(prediction.markets)
    ? prediction.markets
        .slice(0, 8)
        .map((market: any) => `- ${market.market}: ${market.selection}`)
        .join('\n')
    : 'No markets supplied.'
}

============================================================
CURRENT RESEARCH
============================================================

Use Google Search.

Check:

- latest team news
- injuries
- suspensions
- player availability
- expected lineups
- recent form
- home/away form
- current team situation
- credible football analysis

The discussion should react to the current 2xPredict
prediction.

You may support the prediction or challenge it.

Do not invent facts.

============================================================
STYLE
============================================================

This is NOT a news article.

It should sound like a football fan starting a debate.

Use short sentences.

Keep the sentences direct.

Do not mention AI.

Keep the message under 700 characters.

============================================================
CONTEXT
============================================================

${context || 'Create a natural football debate around the selected prediction.'}

============================================================
OUTPUT
============================================================

Return JSON only:

{
  "type": "discussion",
  "title": "string",
  "message": "string",
  "category": "Football Discussion",
  "sources": [
    {
      "title": "string",
      "url": "https://example.com"
    }
  ]
}

Return JSON only.
`.trim();
  }

  // ==========================================================
  // SYSTEM
  // ==========================================================

  private getSystemInstruction(): string {
    return `
You are the football discussion editor for 2xPredict.

Create short and interesting football debates.

Use Google Search for current football information.

Never invent:

- injuries
- suspensions
- player availability
- statistics
- results
- transfers
- quotations
- team news

Do not write an article.

Use short natural sentences.

The goal is to encourage football fans to
agree, disagree, or explain their own view.

Return valid JSON only.
`.trim();
  }

  // ==========================================================
  // VALIDATE
  // ==========================================================

  private validateDiscussion(
    result: AiCommunityDiscussionResult,
  ): AiCommunityDiscussionResult {
    if (!result) {
      throw new BadRequestException('Invalid AI discussion');
    }

    const title = typeof result.title === 'string' ? result.title.trim() : '';

    const message =
      typeof result.message === 'string' ? result.message.trim() : '';

    const category =
      typeof result.category === 'string'
        ? result.category.trim()
        : 'Football Discussion';

    if (!title) {
      throw new BadRequestException('AI discussion title is missing');
    }

    if (!message) {
      throw new BadRequestException('AI discussion message is missing');
    }

    if (title.length > 100) {
      throw new BadRequestException('AI discussion title is too long');
    }

    if (message.length > 700) {
      throw new BadRequestException('AI discussion message is too long');
    }

    return {
      type: CommunityPostType.DISCUSSION,

      title,

      message,

      category,

      sources: this.normalizeSources(result.sources),
    };
  }

  // ==========================================================
  // SOURCES
  // ==========================================================

  private normalizeSources(
    sources: {
      title: string;
      url: string;
    }[],
  ) {
    if (!Array.isArray(sources)) {
      return [];
    }

    return sources
      .filter(
        (source) =>
          source &&
          typeof source.title === 'string' &&
          typeof source.url === 'string',
      )
      .map((source) => ({
        title: source.title.trim(),

        url: source.url.trim(),
      }))
      .filter((source) => source.title && /^https?:\/\//i.test(source.url));
  }
}
