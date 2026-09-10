export interface GeminiCandidateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;

  usageMetadata?: Record<string, unknown>;

  error?: {
    message?: string;
  };
}

export interface GroqChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;

  usage?: Record<string, unknown>;

  error?: {
    message?: string;
  };
}
