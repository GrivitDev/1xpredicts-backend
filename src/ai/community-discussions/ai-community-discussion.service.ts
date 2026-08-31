// src/ai/community-discussions/ai-community-discussion.service.ts

import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { GeminiService } from '../gemini/gemini.service';

import { PredictionsService } from '../../predictions/predictions.service';

import { TavilyService } from '../../tavily/tavily.service';

import { CommunityPostType } from '../../community/enums/community-post-type.enum';
import { AiCommunityDiscussionResult } from './ai-community-discussion.interfaces';

@Injectable()
export class AiCommunityDiscussionService {
  private readonly logger = new Logger(AiCommunityDiscussionService.name);

  constructor(
    private readonly geminiService: GeminiService,

    private readonly predictionsService: PredictionsService,

    private readonly tavilyService: TavilyService,
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

    const research = await this.searchDiscussionResearch(selectedPrediction);

    const result =
      await this.geminiService.generateJson<AiCommunityDiscussionResult>({
        task: 'community_discussion',

        prompt: this.buildPrompt(selectedPrediction, research, context),

        options: {
          maxOutputTokens: 1200,

          systemInstruction: this.getSystemInstruction(),
        },
      });

    if (!result.data) {
      throw new BadRequestException('Gemini returned no discussion');
    }

    const discussion = this.validateDiscussion(result.data);

    return {
      ...discussion,

      sources: this.mergeSources(
        research.results.map((item) => ({
          title: item.title,

          url: item.url,
        })),

        discussion.sources,
      ),
    };
  }

  // ==========================================================
  // SELECT PREDICTION
  // ==========================================================

  private selectPrediction(predictions: any[]) {
    if (!Array.isArray(predictions) || predictions.length === 0) {
      return null;
    }

    return predictions[0];
  }

  // ==========================================================
  // SEARCH CURRENT RESEARCH
  // ==========================================================

  private async searchDiscussionResearch(prediction: any) {
    const query = prediction
      ? `
${prediction.homeTeam} vs ${prediction.awayTeam}
latest football news injuries suspensions team news
lineup manager comments form
      `.trim()
      : `
football latest important match news
today upcoming matches team news injuries
      `.trim();

    return this.tavilyService.searchNews(query, {
      searchDepth: 'basic',

      maxResults: 6,

      timeRange: 'day',

      includeImages: false,
    });
  }

  // ==========================================================
  // PROMPT
  // ==========================================================

  private buildPrompt(
    prediction: any,
    research: any,
    context?: string,
  ): string {
    const researchText = Array.isArray(research?.results)
      ? research.results
          .map((item: any, index: number) =>
            `
${index + 1}. ${item.title}

URL:
${item.url}

Information:
${item.content || 'No summary supplied.'}
`.trim(),
          )
          .join('\n\n')
      : 'No current research available.';

    if (!prediction) {
      return `
Create one short football community discussion for 2xPredict.

There is no current 2xPredict prediction selected.

Use the supplied current football research to create a genuine
football argument around an important match or team.

============================================================
CURRENT RESEARCH
============================================================

${researchText}

============================================================
STYLE
============================================================

This is a football debate, not a news article.

Use short direct sentences.

Make the argument interesting.

Encourage users to agree or disagree.

Do not exaggerate.

Do not invent facts.

Do not mention AI.

Maximum message length: 700 characters.

${context || ''}

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

${researchText}

============================================================
DISCUSSION
============================================================

Start a football argument based on the prediction and current
research.

You may:

- challenge the prediction
- support the prediction
- question one important factor
- highlight a tactical issue
- highlight team news
- ask whether the probability is justified

Do not simply repeat the prediction.

Do not write an article.

Use short sentences.

Maximum message length: 700 characters.

Do not invent facts.

Do not mention AI.

============================================================
CONTEXT
============================================================

${context || 'Create a natural football debate around this match.'}

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

Current web research has already been supplied by Tavily.

Do not claim to have searched the web yourself.

Never invent:

- injuries
- suspensions
- player availability
- statistics
- results
- transfers
- quotations
- team news

Use supplied research carefully.

Do not write an article.

Use short natural sentences.

The goal is to encourage football fans to agree,
disagree, or explain their own view.

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
    sources?: {
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

  // ==========================================================
  // MERGE SOURCES
  // ==========================================================

  private mergeSources(
    ...groups: {
      title: string;
      url: string;
    }[][]
  ) {
    const map = new Map<
      string,
      {
        title: string;
        url: string;
      }
    >();

    for (const group of groups) {
      for (const source of group) {
        if (!map.has(source.url)) {
          map.set(source.url, source);
        }
      }
    }

    return Array.from(map.values());
  }
}
