import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ApiConfig, Message, ToolDefinition, ToolExecution } from './types';
import { getAgentToolDefinitions, executeAgentAction, createOrGetAgentSession } from './api';

// Simple UUID generator
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null | any[]; // Support multimodal content (text + images)
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

interface StreamCallbacks {
  onChunk?: (chunk: string, fullContent: string) => void;
  onToolExecution?: (execution: ToolExecution) => void;
  onComplete?: (finalContent: string, executions: ToolExecution[]) => void;
}

export class LLMClient {
  constructor(private config: ApiConfig) {}

  /**
   * Send a message with tool calling support (streaming)
   */
  async sendMessageStreaming(
    chatId: string,
    messages: Message[],
    useTools: boolean = false,
    callbacks?: StreamCallbacks
  ): Promise<{ content: string; executions: ToolExecution[] }> {
    const sessionId = `chat-${chatId}`;
    await createOrGetAgentSession(sessionId);

    const llmMessages = this.convertMessagesToLLMFormat(messages, useTools);
    const tools = useTools ? await getAgentToolDefinitions() : [];
    const allExecutions: ToolExecution[] = [];

    let iteration = 0;
    const maxIterations = 10;

    while (iteration < maxIterations) {
      iteration++;

      // Call Rust backend for streaming
      const result = await this.streamViaRustBackend(
        llmMessages,
        tools,
        callbacks
      );

      // Check for tool calls
      if (result.toolCalls && result.toolCalls.length > 0) {
        // Execute tools (frontend logic)
        const executions = await this.executeTools(sessionId, result.toolCalls);
        allExecutions.push(...executions);

        // Notify callbacks
        executions.forEach(exec => callbacks?.onToolExecution?.(exec));

        // Add assistant message with tool calls
        llmMessages.push({
          role: 'assistant',
          content: result.content || null,
          tool_calls: result.toolCalls,
        });

        // Add tool results
        for (const execution of executions) {
          llmMessages.push({
            role: 'tool',
            tool_call_id: execution.tool_call_id,
            name: execution.tool_name,
            content: execution.success
              ? JSON.stringify(execution.result)
              : JSON.stringify({ error: execution.error_message }),
          });
        }

        // Continue loop
        continue;
      } else {
        // Final response
        callbacks?.onComplete?.(result.content, allExecutions);
        return { content: result.content, executions: allExecutions };
      }
    }

    throw new Error(`Maximum iterations (${maxIterations}) exceeded`);
  }

  /**
   * Stream via Rust backend (replaces direct SDK calls)
   */
  private async streamViaRustBackend(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    callbacks?: StreamCallbacks
  ): Promise<{ content: string; toolCalls?: any[] }> {
    return new Promise(async (resolve, reject) => {
      const streamId = generateUuid();
      let fullContent = '';
      let toolCalls: any[] = [];

      // Listen for streaming events
      const unlisten1 = await listen<{ chunk: string; full_content: string }>(
        `streaming_chunk_${streamId}`,
        (event) => {
          fullContent = event.payload.full_content;
          callbacks?.onChunk?.(event.payload.chunk, fullContent);
        }
      );

      const unlisten2 = await listen<{ tool_calls: any[] }>(
        `streaming_tool_calls_${streamId}`,
        (event) => {
          toolCalls = event.payload.tool_calls;
        }
      );

      const unlisten3 = await listen(`streaming_complete_${streamId}`, () => {
        unlisten1();
        unlisten2();
        unlisten3();
        resolve({ content: fullContent, toolCalls: toolCalls.length > 0 ? toolCalls : undefined });
      });

      // Start streaming via Rust backend
      try {
        await invoke('stream_llm_request', {
          provider: this.config.provider,
          apiKey: this.config.api_key,
          baseUrl: this.config.base_url || null,
          model: this.config.model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            tool_calls: m.tool_calls,
            tool_call_id: m.tool_call_id,
            name: m.name,
          })),
          tools: tools.length > 0 ? tools : null,
          temperature: this.config.temperature,
          maxTokens: this.config.max_tokens || null,
          streamId,
        });
      } catch (error) {
        unlisten1();
        unlisten2();
        unlisten3();
        reject(error);
      }
    });
  }

  /**
   * Execute tools and return results
   */
  private async executeTools(
    sessionId: string,
    toolCalls: any[]
  ): Promise<ToolExecution[]> {
    const executions: ToolExecution[] = [];

    for (const toolCall of toolCalls) {
      const startTime = new Date().toISOString();

      try {
        const args = JSON.parse(toolCall.function.arguments);

        const result = await executeAgentAction(
          sessionId,
          toolCall.function.name,
          args
        );

        executions.push({
          tool_call_id: toolCall.id,
          tool_name: toolCall.function.name,
          arguments: args,
          result: result.result,
          success: result.success,
          error_message: result.error_message || null,
          timestamp: startTime,
        });
      } catch (error) {
        executions.push({
          tool_call_id: toolCall.id,
          tool_name: toolCall.function.name,
          arguments: {},
          result: null,
          success: false,
          error_message: error instanceof Error ? error.message : String(error),
          timestamp: startTime,
        });
      }
    }

    return executions;
  }

  /**
   * Convert chat messages to LLM format
   */
  private convertMessagesToLLMFormat(messages: Message[], useTools: boolean = false): LLMMessage[] {
    const llmMessages: LLMMessage[] = messages.map(msg => {
      // Handle messages with images (multimodal content)
      if (msg.images && msg.images.length > 0) {
        // Convert to multimodal format
        const contentArray: any[] = [];

        // Add text content first
        if (msg.content) {
          contentArray.push({
            type: 'text',
            text: msg.content,
          });
        }

        // Add images based on provider format
        for (const imageData of msg.images) {
          if (this.config.provider === 'anthropic') {
            // Anthropic format: extract base64 data and media type
            const matches = imageData.match(/^data:([^;]+);base64,(.*)$/);
            if (matches) {
              const mediaType = matches[1];
              const base64Data = matches[2];
              contentArray.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              });
            }
          } else {
            // OpenAI-compatible format (includes OpenAI, DeepSeek, LMStudio, etc.)
            contentArray.push({
              type: 'image_url',
              image_url: {
                url: imageData, // data:image/...;base64,... format
              },
            });
          }
        }

        return {
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: contentArray as any,
        };
      }

      // Regular text-only message
      return {
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      };
    });

    // Add system message if tools are enabled
    if (useTools) {
      llmMessages.unshift({
        role: 'system',
        content: `You are an AI assistant with access to powerful tools for interacting with the user's computer. You have the following capabilities:

- File operations: Read, write, search files and directories
- Terminal commands: Execute shell commands
- Process management: List and control running processes
- Application control: Launch applications

When the user asks you to perform a task that requires these capabilities, USE the tools directly - don't explain how to use them or show JSON examples. Just call the appropriate tool and provide the results in a natural, conversational way.

For example:
- If asked "list files", use the list_directory tool and show the results
- If asked "search for X", use the search_files tool and report what you found
- If asked "read file Y", use the read_file tool and discuss the contents

Be proactive and helpful. Use tools whenever they can help accomplish the user's goals.`,
      });
    }

    return llmMessages;
  }
}
