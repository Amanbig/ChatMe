export interface Chat {
  id: string;
  title: string;
  api_config_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  images?: string[]; // Array of base64 encoded images
}

export interface ChatWithLastMessage {
  id: string;
  title: string;
  api_config_id: string | null;
  api_config_name: string | null;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
}

export interface ApiConfig {
  id: string;
  name: string;
  provider: ApiProvider;
  api_key: string;
  base_url: string | null;
  model: string;
  temperature: number;
  max_tokens: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type ApiProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';

export interface CreateChatRequest {
  title: string;
  api_config_id?: string | null;
}

export interface CreateMessageRequest {
  chat_id: string;
  content: string;
  role: 'user' | 'assistant';
  images?: string[]; // Array of base64 encoded images
}

export interface UpdateChatRequest {
  title: string;
  api_config_id?: string | null;
}

export interface CreateApiConfigRequest {
  name: string;
  provider: ApiProvider;
  api_key: string;
  base_url?: string | null;
  model: string;
  temperature: number;
  max_tokens?: number | null;
  is_default: boolean;
}

export interface UpdateApiConfigRequest {
  name: string;
  api_key: string;
  base_url?: string | null;
  model: string;
  temperature: number;
  max_tokens?: number | null;
  is_default: boolean;
}

export interface StreamingMessage {
  id: string;
  content: string;
  isStreaming: boolean;
  isComplete: boolean;
}