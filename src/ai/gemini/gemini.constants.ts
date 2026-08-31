// src/ai/gemini/gemini.constants.ts

// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================

export const GEMINI_API_KEY_ENV = 'GEMINI_API_KEY';

export const GEMINI_MODEL_ENV = 'GEMINI_MODEL';

export const GEMINI_IMAGE_MODEL_ENV = 'GEMINI_IMAGE_MODEL';

export const GEMINI_GROUNDING_ENV = 'GEMINI_GROUNDING_ENABLED';

// ============================================================
// TEXT MODEL
// ============================================================

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

// ============================================================
// IMAGE MODEL
// ============================================================

export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

// ============================================================
// GENERATION DEFAULTS
// ============================================================

export const GEMINI_DEFAULT_TEMPERATURE = 0.6;

export const GEMINI_DEFAULT_TOP_P = 0.95;

export const GEMINI_DEFAULT_TOP_K = 40;

export const GEMINI_DEFAULT_MAX_OUTPUT_TOKENS = 4096;

// ============================================================
// PREDICTION
// ============================================================

export const GEMINI_PREDICTION_TEMPERATURE = 0.2;

export const GEMINI_PREDICTION_MAX_OUTPUT_TOKENS = 5000;

// ============================================================
// COMMUNITY
// ============================================================

export const GEMINI_ARTICLE_TEMPERATURE = 0.4;

export const GEMINI_ARTICLE_MAX_OUTPUT_TOKENS = 3000;

// ============================================================
// SEARCH
// ============================================================

export const GEMINI_SEARCH_TOOL = {
  googleSearch: {},
} as const;

// ============================================================
// JSON
// ============================================================

export const GEMINI_JSON_MIME_TYPE = 'application/json';

// ============================================================
// PROVIDER
// ============================================================

export const GEMINI_PROVIDER = 'gemini';
