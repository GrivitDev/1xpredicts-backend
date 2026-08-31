// src/ai/community-discussions/ai-community-discussion.interfaces.ts

import { CommunityPostType } from '../../community/enums/community-post-type.enum';

export interface AiCommunityDiscussionResult {
  type: CommunityPostType.DISCUSSION;

  title: string;

  message: string;

  category: string;
}
