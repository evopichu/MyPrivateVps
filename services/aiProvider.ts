import axios, { AxiosInstance } from 'axios';
import { decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';

export interface AIModel {
  id: string;
  name: string;
  description?: string;
  context_window?: number;
  pricing?: {
    input_price_per_1k: number;
    output_price_per_1k: number;
  };
  capabilities?: string[];
}

export interface AIRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface AIResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class AIProviderService {
  private axiosInstance: AxiosInstance;
  private provider: string;
  private apiBase: string;

  constructor(provider: string, apiBase: string) {
    this.provider = provider;
    this.apiBase = apiBase;
    this.axiosInstance = axios.create({
      baseURL: apiBase,
      timeout: 60000,
    });
  }

  async fetchModels(encryptedApiKey: string): Promise<AIModel[]> {
    try {
      const apiKey = decrypt(encryptedApiKey);
      let models: AIModel[] = [];

      if (this.provider === 'openai') {
        models = await this.fetchOpenAIModels(apiKey);
      } else if (this.provider === 'anthropic') {
        models = await this.fetchAnthropicModels(apiKey);
      }

      return models;
    } catch (error) {
      logger.error(`Failed to fetch models from ${this.provider}:`, error);
      throw new Error(`Failed to fetch models: ${error}`);
    }
  }

  private async fetchOpenAIModels(apiKey: string): Promise<AIModel[]> {
    const response = await this.axiosInstance.get('/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const models = response.data.data
      .filter((model: any) => model.id.startsWith('gpt-'))
      .map((model: any) => ({
        id: model.id,
        name: model.id,
        description: model.id,
        context_window: this.getContextWindowForModel(model.id),
        pricing: this.getPricingForModel(model.id),
      }));

    return models;
  }

  private async fetchAnthropicModels(apiKey: string): Promise<AIModel[]> {
    // Anthropic doesn't have a public models endpoint, so we return known models
    const models: AIModel[] = [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most powerful model for complex tasks',
        context_window: 200000,
        pricing: { input_price_per_1k: 0.015, output_price_per_1k: 0.075 },
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Balanced model for most tasks',
        context_window: 200000,
        pricing: { input_price_per_1k: 0.003, output_price_per_1k: 0.015 },
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fast and efficient model',
        context_window: 200000,
        pricing: { input_price_per_1k: 0.00025, output_price_per_1k: 0.00125 },
      },
    ];

    return models;
  }

  async makeRequest(encryptedApiKey: string, request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    try {
      const apiKey = decrypt(encryptedApiKey);
      let response: AIResponse;

      if (this.provider === 'openai') {
        response = await this.makeOpenAIRequest(apiKey, request);
      } else if (this.provider === 'anthropic') {
        response = await this.makeAnthropicRequest(apiKey, request);
      } else {
        throw new Error(`Unsupported provider: ${this.provider}`);
      }

      const duration = Date.now() - startTime;
      logger.info(`AI request completed in ${duration}ms`, {
        provider: this.provider,
        model: request.model,
        tokens: response.usage.total_tokens,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`AI request failed after ${duration}ms:`, error);
      throw error;
    }
  }

  private async makeOpenAIRequest(apiKey: string, request: AIRequest): Promise<AIResponse> {
    const response = await this.axiosInstance.post('/chat/completions', request, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      id: response.data.id,
      model: response.data.model,
      choices: response.data.choices.map((choice: any) => ({
        message: choice.message,
        finish_reason: choice.finish_reason,
      })),
      usage: response.data.usage,
    };
  }

  private async makeAnthropicRequest(apiKey: string, request: AIRequest): Promise<AIResponse> {
    // Convert OpenAI format to Anthropic format
    const anthropicRequest = {
      model: request.model,
      max_tokens: request.max_tokens || 4096,
      messages: request.messages,
      system: request.messages.find((m) => m.role === 'system')?.content,
      stream: request.stream || false,
    };

    const response = await this.axiosInstance.post('/v1/messages', anthropicRequest, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });

    // Convert Anthropic response to OpenAI format
    return {
      id: response.data.id,
      model: response.data.model,
      choices: [{
        message: {
          role: response.data.role,
          content: response.data.content[0]?.text || '',
        },
        finish_reason: response.data.stop_reason,
      }],
      usage: {
        prompt_tokens: response.data.usage.input_tokens,
        completion_tokens: response.data.usage.output_tokens,
        total_tokens: response.data.usage.input_tokens + response.data.usage.output_tokens,
      },
    };
  }

  private getContextWindowForModel(modelId: string): number {
    const contextWindows: Record<string, number> = {
      'gpt-4': 8192,
      'gpt-4-turbo': 128000,
      'gpt-4-turbo-preview': 128000,
      'gpt-3.5-turbo': 16385,
      'gpt-3.5-turbo-16k': 16385,
    };
    return contextWindows[modelId] || 4096;
  }

  private getPricingForModel(modelId: string) {
    const pricing: Record<string, { input_price_per_1k: number; output_price_per_1k: number }> = {
      'gpt-4': { input_price_per_1k: 0.03, output_price_per_1k: 0.06 },
      'gpt-4-turbo': { input_price_per_1k: 0.01, output_price_per_1k: 0.03 },
      'gpt-4-turbo-preview': { input_price_per_1k: 0.01, output_price_per_1k: 0.03 },
      'gpt-3.5-turbo': { input_price_per_1k: 0.0015, output_price_per_1k: 0.002 },
      'gpt-3.5-turbo-16k': { input_price_per_1k: 0.003, output_price_per_1k: 0.004 },
    };
    return pricing[modelId];
  }
}
