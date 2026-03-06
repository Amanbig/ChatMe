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
  AgentCapability,
  ToolDefinition,
  ToolExecutionRecord,
  CreateToolExecutionRequest,
  McpServer,
  McpTool,
  CreateMcpServerRequest,
  UpdateMcpServerRequest
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

export async function getAgentToolDefinitions(): Promise<ToolDefinition[]> {
  return await invoke('get_agent_tool_definitions');
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

// System info
export interface SystemInfo {
  os: string;
  arch: string;
  family: string;
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return await invoke('get_system_info');
}

// Tool Execution operations
export async function createToolExecution(request: CreateToolExecutionRequest): Promise<ToolExecutionRecord> {
  return await invoke('create_tool_execution', { request });
}

export async function getToolExecutionsForMessage(messageId: string): Promise<ToolExecutionRecord[]> {
  return await invoke('get_tool_executions_for_message', { messageId });
}

export async function getToolExecutionsForMessages(messageIds: string[]): Promise<Record<string, ToolExecutionRecord[]>> {
  return await invoke('get_tool_executions_for_messages', { messageIds });
}

// MCP Server operations
export async function createMcpServer(request: CreateMcpServerRequest): Promise<McpServer> {
  return await invoke('create_mcp_server', { request });
}

export async function getMcpServers(): Promise<McpServer[]> {
  return await invoke('get_mcp_servers');
}

export async function getMcpServer(serverId: string): Promise<McpServer | null> {
  return await invoke('get_mcp_server', { serverId });
}

export async function updateMcpServer(serverId: string, request: UpdateMcpServerRequest): Promise<McpServer> {
  return await invoke('update_mcp_server', { serverId, request });
}

export async function deleteMcpServer(serverId: string): Promise<void> {
  return await invoke('delete_mcp_server', { serverId });
}

// MCP Tool operations
export async function getMcpToolsForServer(serverId: string): Promise<McpTool[]> {
  return await invoke('get_mcp_tools_for_server', { serverId });
}

export async function getEnabledMcpTools(): Promise<McpTool[]> {
  return await invoke('get_enabled_mcp_tools');
}

export async function toggleMcpTool(toolId: string, enabled: boolean): Promise<void> {
  return await invoke('toggle_mcp_tool', { toolId, enabled });
}