// src/ai/gemini/gemini.interfaces.ts

import {
  GeminiGenerationOptions,
  GeminiSource,
  GeminiTask,
} from './gemini.types';

// ============================================================
// BASIC REQUEST
// ============================================================

export interface GeminiGenerateRequest {
  prompt: string;

  task?: GeminiTask;

  options?: GeminiGenerationOptions;
}

// ============================================================
// MULTIMODAL IMAGE
// ============================================================

export interface GeminiImageInput {
  mimeType: string;

  base64: string;
}

// ============================================================
// MULTIMODAL REQUEST
// ============================================================

export interface GeminiMultimodalRequest {
  prompt: string;

  images?: GeminiImageInput[];

  task?: GeminiTask;

  options?: GeminiGenerationOptions;
}

// ============================================================
// HEALTH
// ============================================================

export interface GeminiHealthStatus {
  configured: boolean;

  provider: 'gemini';

  model: string;

  googleSearchEnabled: boolean;
}

// ============================================================
// GROUNDED RESULT
// ============================================================

export interface GeminiGroundingResult {
  grounded: boolean;

  sources: GeminiSource[];
}
