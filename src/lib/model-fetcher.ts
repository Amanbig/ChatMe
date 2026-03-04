import OpenAI from 'openai';
import type { ApiProvider } from './types';

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

/**
 * Fetch available models for a given provider
 */
export async function fetchAvailableModels(
  provider: ApiProvider,
  apiKey: string,
  baseUrl?: string
): Promise<ModelInfo[]> {
  try {
    switch (provider) {
      case 'openai':
        return await fetchOpenAIModels(apiKey, baseUrl);

      case 'anthropic':
        return getAnthropicModels();

      case 'deepseek':
        return await fetchOpenAICompatibleModels(
          apiKey,
          baseUrl || 'https://api.deepseek.com/v1'
        );

      case 'lmstudio':
        return await fetchOpenAICompatibleModels(
          apiKey || 'lmstudio',
          baseUrl || 'http://localhost:1234/v1'
        );

      case 'mistral':
        return await fetchOpenAICompatibleModels(
          apiKey,
          baseUrl || 'https://api.mistral.ai/v1'
        );

      case 'kimi':
        return await fetchOpenAICompatibleModels(
          apiKey,
          baseUrl || 'https://api.moonshot.cn/v1'
        );

      case 'ollama':
        return await fetchOllamaModels(baseUrl || 'http://localhost:11434');

      case 'google':
        return getGoogleModels();

      case 'custom':
        // For custom providers, try OpenAI-compatible format
        if (baseUrl) {
          return await fetchOpenAICompatibleModels(apiKey, baseUrl);
        }
        return [];

      default:
        return [];
    }
  } catch (error) {
    console.error(`Error fetching models for ${provider}:`, error);
    throw error;
  }
}

/**
 * Fetch models from OpenAI API
 */
async function fetchOpenAIModels(apiKey: string, baseUrl?: string): Promise<ModelInfo[]> {
  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.models.list();
  const models = Array.from(response.data)
    .filter(model => model.id.includes('gpt')) // Filter for chat models
    .map(model => ({
      id: model.id,
      name: model.id,
    }))
    .sort((a, b) => b.id.localeCompare(a.id)); // Sort newest first

  return models;
}

/**
 * Fetch models from any OpenAI-compatible API
 */
async function fetchOpenAICompatibleModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl,
    dangerouslyAllowBrowser: true,
  });

  try {
    const response = await client.models.list();
    return Array.from(response.data).map(model => ({
      id: model.id,
      name: model.id,
    }));
  } catch (error) {
    console.error('Error fetching OpenAI-compatible models:', error);
    throw error;
  }
}

/**
 * Get Anthropic models (fixed list)
 */
function getAnthropicModels(): ModelInfo[] {
  return [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      description: 'Most intelligent model',
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      description: 'Fastest model',
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      description: 'Powerful model for complex tasks',
    },
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      description: 'Balanced model',
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      description: 'Fast and efficient',
    },
  ];
}

/**
 * Get Google models (fixed list)
 */
function getGoogleModels(): ModelInfo[] {
  return [
    {
      id: 'gemini-2.0-flash-exp',
      name: 'Gemini 2.0 Flash (Experimental)',
      description: 'Latest experimental model',
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      description: 'Most capable model',
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      description: 'Fast and efficient',
    },
    {
      id: 'gemini-1.0-pro',
      name: 'Gemini 1.0 Pro',
      description: 'Stable production model',
    },
  ];
}

/**
 * Fetch locally installed Ollama models
 */
async function fetchOllamaModels(baseUrl: string): Promise<ModelInfo[]> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    const data = await response.json();

    if (data.models && Array.isArray(data.models)) {
      return data.models.map((model: any) => ({
        id: model.name,
        name: model.name,
        description: `Size: ${formatBytes(model.size)}`,
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    throw error;
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
