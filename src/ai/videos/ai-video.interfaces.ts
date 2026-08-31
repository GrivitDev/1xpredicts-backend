// src/ai/videos/ai-video.interfaces.ts

export interface AiVideoSource {
  title: string;
  url: string;
  channel?: string;
}

export interface AiVideoPostResult {
  title: string;
  message: string;
  category: string;

  video: {
    url: string;
    platform: 'youtube';
    videoId: string;
  };

  source: AiVideoSource;
}
