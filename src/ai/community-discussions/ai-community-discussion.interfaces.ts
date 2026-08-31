// src/ai/community-discussions/ai-community-discussion.interfaces.ts

import { CommunityPostType } from '../../community/enums/community-post-type.enum';

import { AiResearchSource } from '../predictions/ai-prediction.interfaces';

export interface AiCommunityDiscussionResult {
  type: CommunityPostType.DISCUSSION;

  title: string;

  message: string;

  category: string;

  sources: AiResearchSource[];
}
