import Anthropic from '@anthropic-ai/sdk';
import { LLMConfig } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('llm-client');

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export class LLMClient {
  private config: LLMConfig;
  private anthropicClient: Anthropic | null = null;

  constructor(config: LLMConfig) {
    this.config = config;

    if (config.provider === 'anthropic') {
      this.anthropicClient = new Anthropic({
        apiKey: config.apiKey,
      });
    }
  }

  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    logger.debug({ promptLength: prompt.length, provider: this.config.provider }, 'Sending completion request');

    if (this.config.provider === 'anthropic') {
      return this.completeAnthropic(prompt, systemPrompt);
    } else {
      return this.completeOpenRouter(prompt, systemPrompt);
    }
  }

  async completeWithImage(
    prompt: string,
    imageBase64: string,
    systemPrompt?: string
  ): Promise<string> {
    logger.debug(
      { promptLength: prompt.length, hasImage: true, provider: this.config.provider },
      'Sending vision request'
    );

    if (this.config.provider === 'anthropic') {
      return this.completeWithImageAnthropic(prompt, imageBase64, systemPrompt);
    } else {
      return this.completeWithImageOpenRouter(prompt, imageBase64, systemPrompt);
    }
  }

  // ============================================================================
  // Anthropic Implementation
  // ============================================================================

  private async completeAnthropic(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.anthropicClient) throw new Error('Anthropic client not initialized');

    const response = await this.anthropicClient.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    logger.debug({ responseLength: textContent.text.length }, 'Completion received');
    return textContent.text;
  }

  private async completeWithImageAnthropic(
    prompt: string,
    imageBase64: string,
    systemPrompt?: string
  ): Promise<string> {
    if (!this.anthropicClient) throw new Error('Anthropic client not initialized');

    const response = await this.anthropicClient.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    logger.debug({ responseLength: textContent.text.length }, 'Vision response received');
    return textContent.text;
  }

  // ============================================================================
  // OpenRouter Implementation (OpenAI-compatible)
  // ============================================================================

  private async completeOpenRouter(prompt: string, systemPrompt?: string): Promise<string> {
    const baseUrl = this.config.baseUrl ?? OPENROUTER_BASE_URL;

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'HTTP-Referer': 'https://github.com/sentinel-browser',
        'X-Title': 'SentinelBrowser',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenRouter response');
    }

    logger.debug({ responseLength: content.length }, 'Completion received');
    return content;
  }

  private async completeWithImageOpenRouter(
    prompt: string,
    imageBase64: string,
    systemPrompt?: string
  ): Promise<string> {
    const baseUrl = this.config.baseUrl ?? OPENROUTER_BASE_URL;

    const messages: Array<{
      role: string;
      content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    }> = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // OpenAI-style vision format
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${imageBase64}`,
          },
        },
        {
          type: 'text',
          text: prompt,
        },
      ],
    });

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'HTTP-Referer': 'https://github.com/sentinel-browser',
        'X-Title': 'SentinelBrowser',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenRouter response');
    }

    logger.debug({ responseLength: content.length }, 'Vision response received');
    return content;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  async completeJson<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const jsonPrompt = `${prompt}\n\nRespond with valid JSON only, no markdown or explanation.`;

    const response = await this.complete(jsonPrompt, systemPrompt);

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }

    return JSON.parse(jsonStr.trim()) as T;
  }
}
