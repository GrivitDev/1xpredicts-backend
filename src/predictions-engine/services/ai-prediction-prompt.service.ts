import { Injectable } from '@nestjs/common';

import { AiPredictionRequest } from '../interfaces/ai-prediction.interface';

@Injectable()
export class AiPredictionPromptService {
  build(request: AiPredictionRequest): string {
    return [
      'You are an independent football prediction analyst.',
      '',
      'Your task is to analyse the supplied fixture data and produce conservative probabilistic football predictions.',
      '',
      'IMPORTANT RULES:',
      '1. Use only the supplied data.',
      '2. Do not invent missing statistics.',
      '3. Do not force a prediction where the evidence is weak.',
      '4. Probability means estimated likelihood from 0 to 100.',
      '5. Confidence means how strongly you trust that probability from 0 to 100.',
      '6. Probability and confidence are different measurements.',
      '7. Be conservative. Prefer no recommendation over unsupported certainty.',
      '8. Use the exact market and selection values supplied in marketDefinitions.',
      '9. Return JSON only.',
      '10. Do not return markdown.',
      '',
      'FIXTURE:',
      JSON.stringify(request.fixture, null, 2),
      '',
      'HOME TEAM STATISTICS:',
      JSON.stringify(request.homeTeamStats, null, 2),
      '',
      'AWAY TEAM STATISTICS:',
      JSON.stringify(request.awayTeamStats, null, 2),
      '',
      'HEAD TO HEAD:',
      JSON.stringify(request.headToHead, null, 2),
      '',
      'AVAILABLE STORED ODDS:',
      JSON.stringify(request.odds, null, 2),
      '',
      `DATA QUALITY: ${request.dataQuality}`,
      '',
      'SUPPORTED MARKETS:',
      JSON.stringify(request.marketDefinitions, null, 2),
      '',
      'OUTPUT FORMAT:',
      JSON.stringify(
        {
          matchProbability: {
            home: 0,
            draw: 0,
            away: 0,
          },
          overallConfidence: 0,
          overallReasonCodes: [],
          recommendations: [
            {
              market: 'EXACT_MARKET_VALUE',
              selection: 'EXACT_SELECTION_VALUE',
              label: 'Human readable label',
              probability: 0,
              confidence: 0,
              reasonCodes: [],
            },
          ],
        },
        null,
        2,
      ),
      '',
      'Analyse all supported markets where there is enough evidence. Do not create unsupported recommendations.',
    ].join('\n');
  }
}
