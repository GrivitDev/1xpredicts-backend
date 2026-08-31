// src/ai/community-post/ai-community-post.interfaces.ts

import { CommunityPostType } from '../../community/enums/community-post-type.enum';

import { GeminiSource } from '../gemini/gemini.types';

// ============================================================
// NEWS SOURCE
// ============================================================

export interface AiCommunityNewsSource {
  title: string;

  url: string;
}

// ============================================================
// GENERATED POST
// ============================================================

export interface AiCommunityPostResult {
  type: CommunityPostType.MEDIA;

  title: string;

  message: string;

  category: string;

  importance: 'high' | 'medium';

  imageNeeded: boolean;

  imagePrompt?: string;

  imageUrl: string;

  sources: AiCommunityNewsSource[];
}

// ============================================================
// REQUEST
// ============================================================

export interface AiCommunityPostRequest {
  topic?: string;

  category?: string;

  publish?: boolean;
}

// ============================================================
// PUBLISHED RESULT
// ============================================================

export interface AiPublishedCommunityPost {
  post: unknown;

  ai: {
    grounded: boolean;

    sources: GeminiSource[];
  };
}
