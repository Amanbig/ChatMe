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
  role: 'user' | 'assistant' | 'system';
  created_at: string;
  images?: string[]; // Array of base64 encoded images
  permission_request_id?: string;
  permission_request?: PermissionRequest;
}

export interface PermissionRequest {
  id: string;
  chat_id: string;
  operation: string;
  description: string;
  level: 'Safe' | 'Moderate' | 'Dangerous';
  details: Record<string, string>;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  updated_at: string;
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

export type ApiProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'ollama'
  | 'mistral'
  | 'deepseek'
  | 'lmstudio'
  | 'kimi'
  | 'openrouter'
  | 'together'
  | 'groq'
  | 'perplexity'
  | 'custom';

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

// File Operations Types
export interface FileInfo {
  name: string;
  path: string;
  is_directory: boolean;
  size?: number;
  modified?: string;
  file_type?: string;
}

export interface DirectoryContents {
  files: FileInfo[];
  directories: FileInfo[];
  total_files: number;
  total_directories: number;
}

export interface SearchResult {
  file_path: string;
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

// Agentic Mode Types
export interface AgentAction {
  action_type: string;
  description: string;
  parameters: Record<string, any>;
  result?: any;
  success: boolean;
  error_message?: string;
}

export interface AgentSession {
  id: string;
  active: boolean;
  actions: AgentAction[];
  context: Record<string, any>;
  current_directory: string;
  capabilities: string[];
}

export interface AgentCapability {
  name: string;
  description: string;
  parameters: AgentParameter[];
}

export interface AgentParameter {
  name: string;
  parameter_type: string;
  description: string;
  required: boolean;
  default_value?: any;
}

// Tool Calling Types
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any; // JSON Schema
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ToolExecution {
  tool_call_id: string;
  tool_name: string;
  arguments: any;
  result: any | null;
  success: boolean;
  error_message: string | null;
  timestamp: string;
}

// Persisted tool execution record from database
export interface ToolExecutionRecord {
  id: string;
  message_id: string;
  tool_call_id: string;
  tool_name: string;
  tool_source: string; // 'builtin' or mcp_server_id
  arguments: any;
  result: any | null;
  success: boolean;
  error_message: string | null;
  execution_order: number;
  started_at: string;
  completed_at: string | null;
}

export interface CreateToolExecutionRequest {
  message_id: string;
  tool_call_id: string;
  tool_name: string;
  tool_source: string;
  arguments: any;
  result: any | null;
  success: boolean;
  error_message: string | null;
  execution_order: number;
  started_at: string;
  completed_at: string | null;
}

export interface ConversationTurn {
  assistant_message: {
    role: string;
    content: string | null;
    tool_calls: ToolCall[] | null;
  };
  tool_executions: ToolExecution[];
}

// Enhanced Message type with tool execution history
export interface MessageWithTools extends Message {
  tool_turns?: ConversationTurn[];
}