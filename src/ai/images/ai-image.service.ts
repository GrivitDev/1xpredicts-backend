// src/ai/images/ai-image.service.ts

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { GoogleGenAI } from '@google/genai';

import { UploadsService } from '../../uploads/uploads.service';

import { UploadFolder } from '../../uploads/enums/upload-folder.enum';

import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  GEMINI_API_KEY_ENV,
  GEMINI_IMAGE_MODEL_ENV,
} from '../gemini/gemini.constants';

// ============================================================
// RESULT
// ============================================================

export interface AiGeneratedImageResult {
  url: string;

  publicId: string;

  width: number;

  height: number;

  format: string;

  bytes: number;
}

// ============================================================
// SERVICE
// ============================================================

@Injectable()
export class AiImageService {
  private readonly logger = new Logger(AiImageService.name);

  private readonly client: GoogleGenAI;

  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,

    private readonly uploadsService: UploadsService,
  ) {
    const apiKey = this.configService.get<string>(GEMINI_API_KEY_ENV);

    if (!apiKey) {
      throw new Error(`${GEMINI_API_KEY_ENV} is missing`);
    }

    this.model =
      this.configService.get<string>(GEMINI_IMAGE_MODEL_ENV) ||
      DEFAULT_GEMINI_IMAGE_MODEL;

    this.client = new GoogleGenAI({
      apiKey,
    });
  }

  // ==========================================================
  // GENERATE COMMUNITY IMAGE
  // ==========================================================

  async generateCommunityImage(
    prompt: string,
  ): Promise<AiGeneratedImageResult> {
    if (!prompt?.trim()) {
      throw new BadRequestException('Image prompt is required');
    }

    const finalPrompt = `
Create a professional editorial football image for
2xPredict.

The image is for a football news/community post.

Create an original visual.

Do not reproduce copyrighted photographs.

Do not copy a known photographer's composition.

Do not include watermarks.

Do not include fake news text.

Do not invent official club announcements.

Do not create fake screenshots.

Use a clean sports-editorial composition.

Image description:

${prompt.trim()}
`.trim();

    try {
      const response = await this.client.models.generateContent({
        model: this.model,

        contents: finalPrompt,

        config: {
          responseModalities: ['IMAGE'],
        },
      });

      const imagePart = this.extractImagePart(response);

      if (!imagePart) {
        throw new Error('Gemini returned no image');
      }

      const buffer = Buffer.from(imagePart.data, 'base64');

      const uploaded = await this.uploadsService.uploadBuffer(
        buffer,
        UploadFolder.COMMUNITY,
      );

      this.logger.log(
        `AI community image generated and uploaded: ${uploaded.publicId}`,
      );

      return uploaded;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `AI image generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      throw new InternalServerErrorException('AI image generation failed');
    }
  }

  // ==========================================================
  // EXTRACT IMAGE
  // ==========================================================

  private extractImagePart(response: any): {
    data: string;
    mimeType: string;
  } | null {
    const candidates = response?.candidates || [];

    for (const candidate of candidates) {
      const parts = candidate?.content?.parts || [];

      for (const part of parts) {
        if (part?.inlineData?.data) {
          return {
            data: part.inlineData.data,

            mimeType: part.inlineData.mimeType || 'image/png',
          };
        }
      }
    }

    return null;
  }
}
