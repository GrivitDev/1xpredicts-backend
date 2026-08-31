// src/ai/gemini/gemini.constants.ts

// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================

export const GEMINI_API_KEY_ENV = 'GEMINI_API_KEY';

export const GEMINI_MODEL_ENV = 'GEMINI_MODEL';

export const GEMINI_IMAGE_MODEL_ENV = 'GEMINI_IMAGE_MODEL';

// Kept for environment compatibility.
// Gemini Google Search is no longer used by our application.
export const GEMINI_GROUNDING_ENV = 'GEMINI_GROUNDING_ENABLED';

// ============================================================
// TEXT MODEL
// ============================================================

export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

// ============================================================
// IMAGE MODEL
// ============================================================
//
// Not currently used by community news posts.
// Community posts now use image URLs returned by Tavily.
//
// Current Gemini native image model endpoint:
// gemini-3.1-flash-image
//
// ============================================================

export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';

// ============================================================
// GENERATION DEFAULTS
// ============================================================

export const GEMINI_DEFAULT_MAX_OUTPUT_TOKENS = 4096;

// ============================================================
// PREDICTION
// ============================================================

export const GEMINI_PREDICTION_MAX_OUTPUT_TOKENS = 5000;

// ============================================================
// COMMUNITY
// ============================================================

export const GEMINI_ARTICLE_MAX_OUTPUT_TOKENS = 3000;

// ============================================================
// JSON
// ============================================================

export const GEMINI_JSON_MIME_TYPE = 'application/json';

// ============================================================
// PROVIDER
// ============================================================

export const GEMINI_PROVIDER = 'gemini';
