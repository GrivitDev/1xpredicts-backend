// src/ai/gemini/gemini.controller.ts

import { Body, Controller, Get, Post } from '@nestjs/common';

import { GeminiService } from './gemini.service';

import * as geminiInterfaces from './gemini.interfaces';

@Controller('ai/gemini')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  // ============================================================
  // HEALTH
  // ============================================================

  @Get('health')
  health() {
    return this.geminiService.getHealth();
  }

  // ============================================================
  // TEST TEXT GENERATION
  // ============================================================

  @Post('test')
  async test(
    @Body()
    body: geminiInterfaces.GeminiGenerateRequest,
  ) {
    return this.geminiService.generate({
      prompt: body.prompt || 'Say hello to 2xPredict in one sentence.',
    });
  }

  // ============================================================
  // TEST JSON GENERATION
  // ============================================================

  @Post('test-json')
  async testJson(
    @Body()
    body: geminiInterfaces.GeminiGenerateRequest,
  ) {
    return this.geminiService.generateJson({
      prompt:
        body.prompt ||
        `
Return JSON only.

{
  "message": "Hello from Gemini",
  "success": true
}
        `.trim(),

      task: body.task || 'general',

      options: body.options,
    });
  }
}
