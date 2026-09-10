import {
  AiPredictionRecommendation,
  AiPredictionResponse,
} from '../interfaces/ai-prediction.interface';

export function parseAiPredictionResponse(raw: string): AiPredictionResponse {
  const jsonText = extractJson(raw);

  if (!jsonText) {
    throw new Error('AI response did not contain valid JSON');
  }

  const parsed: unknown = JSON.parse(jsonText);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI response JSON must be an object');
  }

  const value = parsed as Record<string, unknown>;

  const recommendations = Array.isArray(value.recommendations)
    ? value.recommendations
        .map(normalizeRecommendation)
        .filter(
          (recommendation): recommendation is AiPredictionRecommendation =>
            recommendation !== null,
        )
    : [];

  const matchProbability = normalizeMatchProbability(value.matchProbability);

  const overallConfidence =
    normalizeNumber(value.overallConfidence) ?? undefined;

  const overallReasonCodes = Array.isArray(value.overallReasonCodes)
    ? value.overallReasonCodes
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  return {
    matchProbability,

    recommendations,

    overallConfidence,

    overallReasonCodes,
  };
}

function normalizeRecommendation(
  value: unknown,
): AiPredictionRecommendation | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Record<string, unknown>;

  const market = typeof item.market === 'string' ? item.market.trim() : '';

  const selection =
    typeof item.selection === 'string' ? item.selection.trim() : '';

  const label = typeof item.label === 'string' ? item.label.trim() : selection;

  const probability = normalizeNumber(item.probability);

  const confidence = normalizeNumber(item.confidence);

  const reasonCodes = Array.isArray(item.reasonCodes)
    ? item.reasonCodes
        .filter((reason): reason is string => typeof reason === 'string')
        .map((reason) => reason.trim())
        .filter(Boolean)
    : [];

  if (!market || !selection || probability === null || confidence === null) {
    return null;
  }

  return {
    market: market as AiPredictionRecommendation['market'],

    selection,

    label,

    probability: Math.min(100, Math.max(0, probability)),

    confidence: Math.min(100, Math.max(0, confidence)),

    reasonCodes,
  };
}

function normalizeMatchProbability(value: unknown):
  | {
      home: number;
      draw: number;
      away: number;
    }
  | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const input = value as Record<string, unknown>;

  const home = normalizeNumber(input.home);

  const draw = normalizeNumber(input.draw);

  const away = normalizeNumber(input.away);

  if (home === null || draw === null || away === null) {
    return undefined;
  }

  const values = [Math.max(0, home), Math.max(0, draw), Math.max(0, away)];

  const total = values.reduce((sum, item) => sum + item, 0);

  if (total <= 0) {
    return undefined;
  }

  return {
    home: Number(((values[0] / total) * 100).toFixed(2)),

    draw: Number(((values[1] / total) * 100).toFixed(2)),

    away: Number(((values[2] / total) * 100).toFixed(2)),
  };
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractJson(raw: string): string | null {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fenced?.[1]?.trim()) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf('{');

  const end = trimmed.lastIndexOf('}');

  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return null;
}
