import { invoke } from '@tauri-apps/api/core';
import type { ApiProvider } from './types';

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

/**
 * Fetch available models for a given provider
 * Uses Tauri backend to bypass CORS restrictions
 */
export async function fetchAvailableModels(
  provider: ApiProvider,
  apiKey: string,
  baseUrl?: string
): Promise<ModelInfo[]> {
  try {
    const models = await invoke<ModelInfo[]>('fetch_provider_models', {
      provider,
      apiKey: apiKey || '',
      baseUrl: baseUrl || null,
    });

    // Deduplicate models by ID (some APIs return duplicates)
    const uniqueModels = Array.from(
      new Map(models.map(m => [m.id, m])).values()
    );

    return uniqueModels;
  } catch (error) {
    console.error(`Error fetching models for ${provider}:`, error);
    throw error;
  }
}
