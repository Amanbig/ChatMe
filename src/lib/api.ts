import { invoke } from '@tauri-apps/api/core';
import type { 
  Chat, 
  Message, 
  ChatWithLastMessage, 
  CreateChatRequest, 
  CreateMessageRequest, 
  UpdateChatRequest,
  ApiConfig,
  CreateApiConfigRequest,
  UpdateApiConfigRequest,
  DirectoryContents,
  SearchResult,
  AgentSession,
  AgentAction,
  AgentCapability
} from './types';

// Chat operations
export async function createChat(request: CreateChatRequest): Promise<Chat> {
  return await invoke('create_chat', { request });
}

export async function getChats(): Promise<ChatWithLastMessage[]> {
  return await invoke('get_chats');
}

export async function getChat(chatId: string): Promise<Chat | null> {
  return await invoke('get_chat', { chatId });
}

export async function updateChat(chatId: string, request: UpdateChatRequest): Promise<Chat> {
  return await invoke('update_chat', { chatId, request });
}

export async function deleteChat(chatId: string): Promise<void> {
  return await invoke('delete_chat', { chatId });
}

// Message operations
export async function createMessage(request: CreateMessageRequest): Promise<Message> {
  return await invoke('create_message', { request });
}

export async function getMessages(chatId: string): Promise<Message[]> {
  return await invoke('get_messages', { chatId });
}

export async function deleteMessage(messageId: string): Promise<void> {
  return await invoke('delete_message', { messageId });
}

// API Configuration operations
export async function createApiConfig(request: CreateApiConfigRequest): Promise<ApiConfig> {
  return await invoke('create_api_config', { request });
}

export async function getApiConfigs(): Promise<ApiConfig[]> {
  return await invoke('get_api_configs');
}

export async function getApiConfig(configId: string): Promise<ApiConfig | null> {
  return await invoke('get_api_config', { configId });
}

export async function getDefaultApiConfig(): Promise<ApiConfig | null> {
  return await invoke('get_default_api_config');
}

export async function updateApiConfig(configId: string, request: UpdateApiConfigRequest): Promise<ApiConfig> {
  return await invoke('update_api_config', { configId, request });
}

export async function deleteApiConfig(configId: string): Promise<void> {
  return await invoke('delete_api_config', { configId });
}

// AI Chat operations
export async function sendAiMessage(chatId: string, userMessage: string): Promise<Message> {
  return await invoke('send_ai_message', { chatId, userMessage });
}

export async function sendAiMessageStreaming(chatId: string, userMessage: string, images?: string[]): Promise<string> {
  return await invoke('send_ai_message_streaming', { chatId, userMessage, images });
}

// File Operations
export async function openFileWithDefaultApp(filePath: string): Promise<string> {
  return await invoke('open_file_with_default_app', { filePath });
}

export async function readDirectory(directoryPath: string, recursive?: boolean): Promise<DirectoryContents> {
  return await invoke('read_directory', { directoryPath, recursive });
}

export async function searchFiles(
  directoryPath: string,
  pattern: string,
  fileExtension?: string,
  caseSensitive?: boolean,
  recursive?: boolean,
  maxResults?: number
): Promise<SearchResult[]> {
  return await invoke('search_files', {
    directoryPath,
    pattern,
    fileExtension,
    caseSensitive,
    recursive,
    maxResults
  });
}

export async function readFile(filePath: string): Promise<string> {
  return await invoke('read_file', { filePath });
}

export async function writeFile(filePath: string, contents: string): Promise<string> {
  return await invoke('write_file', { filePath, contents });
}

// Agentic Mode Operations
export async function createAgentSession(sessionId: string): Promise<AgentSession> {
  return await invoke('create_agent_session', { sessionId });
}

export async function getAgentCapabilities(): Promise<AgentCapability[]> {
  return await invoke('get_agent_capabilities');
}

export async function executeAgentAction(
  sessionId: string,
  actionType: string,
  parameters: Record<string, any>
): Promise<AgentAction> {
  return await invoke('execute_agent_action', { sessionId, actionType, parameters });
}

export async function getAgentSession(sessionId: string): Promise<AgentSession> {
  return await invoke('get_agent_session', { sessionId });
}

export async function createOrGetAgentSession(sessionId: string): Promise<AgentSession> {
  return await invoke('create_or_get_agent_session', { sessionId });
}