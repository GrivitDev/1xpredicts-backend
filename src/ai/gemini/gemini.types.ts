// src/ai/gemini/gemini.types.ts

// ============================================================
// TASK TYPES
// ============================================================

export type GeminiTask =
  | 'general'
  | 'article'
  | 'community_post'
  | 'community_discussion'
  | 'prediction'
  | 'telegram'
  | 'image_prompt'
  | 'seo';

// ============================================================
// RESPONSE FORMAT
// ============================================================

export type GeminiResponseFormat = 'text' | 'json';

// ============================================================
// GENERATION OPTIONS
// ============================================================

export interface GeminiGenerationOptions {
  model?: string;

  maxOutputTokens?: number;

  responseFormat?: GeminiResponseFormat;

  systemInstruction?: string;
}

// ============================================================
// USAGE
// ============================================================

export interface GeminiUsage {
  promptTokenCount?: number;

  candidatesTokenCount?: number;

  totalTokenCount?: number;
}

// ============================================================
// SOURCE
// ============================================================

export interface GeminiSource {
  title: string;

  url: string;
}

// ============================================================
// STANDARD RESULT
// ============================================================

export interface GeminiResult<T = string> {
  success: boolean;

  data?: T;

  text?: string;

  model: string;

  usage?: GeminiUsage;

  sources?: GeminiSource[];

  grounded: boolean;

  error?: string;
}
