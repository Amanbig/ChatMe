import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
// import { GoogleGenerativeAI } from '@google/generative-ai'; // Will be used when Google is implemented
import type { ApiConfig, Message, ToolDefinition, ToolExecution } from './types';
import { getAgentToolDefinitions, executeAgentAction, createOrGetAgentSession } from './api';

interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
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
  private openaiClient: OpenAI | null = null;
  private anthropicClient: Anthropic | null = null;
  // Google client will be added when Google provider is fully implemented
  // private googleClient: GoogleGenerativeAI | null = null;

  constructor(private config: ApiConfig) {
    this.initializeClient();
  }

  private initializeClient() {
    switch (this.config.provider) {
      case 'openai':
        this.openaiClient = new OpenAI({
          apiKey: this.config.api_key,
          baseURL: this.config.base_url || undefined,
          dangerouslyAllowBrowser: true,
        });
        break;
      case 'anthropic':
        this.anthropicClient = new Anthropic({
          apiKey: this.config.api_key,
          baseURL: this.config.base_url || undefined,
          dangerouslyAllowBrowser: true,
        });
        break;
      case 'google':
        // Google implementation coming soon
        throw new Error('Google provider not yet implemented in new architecture');
      case 'deepseek':
      case 'lmstudio':
      case 'mistral':
      case 'kimi':
        // These are OpenAI-compatible
        this.openaiClient = new OpenAI({
          apiKey: this.config.api_key,
          baseURL: this.config.base_url || this.getDefaultBaseURL(),
          dangerouslyAllowBrowser: true,
        });
        break;
      case 'ollama':
        // Ollama is OpenAI-compatible
        this.openaiClient = new OpenAI({
          apiKey: 'ollama', // Ollama doesn't require an API key
          baseURL: this.config.base_url || 'http://localhost:11434/v1',
          dangerouslyAllowBrowser: true,
        });
        break;
    }
  }

  private getDefaultBaseURL(): string {
    switch (this.config.provider) {
      case 'deepseek':
        return 'https://api.deepseek.com/v1';
      case 'lmstudio':
        return 'http://localhost:1234/v1';
      case 'mistral':
        return 'https://api.mistral.ai/v1';
      case 'kimi':
        return 'https://api.moonshot.cn/v1';
      default:
        return 'https://api.openai.com/v1';
    }
  }

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

    const llmMessages = this.convertMessagesToLLMFormat(messages);
    const tools = useTools ? await getAgentToolDefinitions() : [];
    const allExecutions: ToolExecution[] = [];

    let iteration = 0;
    const maxIterations = 10;

    while (iteration < maxIterations) {
      iteration++;

      if (this.config.provider === 'openai' || ['deepseek', 'lmstudio', 'mistral', 'ollama'].includes(this.config.provider)) {
        const result = await this.handleOpenAIStream(llmMessages, tools, sessionId, callbacks);

        if (result.toolCalls && result.toolCalls.length > 0) {
          // Execute tools
          const executions = await this.executeTools(sessionId, result.toolCalls);
          allExecutions.push(...executions);

          // Notify about tool executions
          executions.forEach(exec => callbacks?.onToolExecution?.(exec));

          // Add assistant message with tool calls
          llmMessages.push({
            role: 'assistant',
            content: null,
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
      } else if (this.config.provider === 'anthropic') {
        // Anthropic implementation
        const result = await this.handleAnthropicStream(llmMessages, tools, sessionId, callbacks);

        if (result.toolCalls && result.toolCalls.length > 0) {
          const executions = await this.executeTools(sessionId, result.toolCalls);
          allExecutions.push(...executions);
          executions.forEach(exec => callbacks?.onToolExecution?.(exec));

          llmMessages.push({
            role: 'assistant',
            content: null,
            tool_calls: result.toolCalls,
          });

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

          continue;
        } else {
          callbacks?.onComplete?.(result.content, allExecutions);
          return { content: result.content, executions: allExecutions };
        }
      } else {
        // Fallback for other providers without tool support
        const content = await this.handleBasicStream(llmMessages, callbacks);
        callbacks?.onComplete?.(content, []);
        return { content, executions: [] };
      }
    }

    throw new Error(`Maximum iterations (${maxIterations}) exceeded`);
  }

  private async handleOpenAIStream(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    _sessionId: string,
    callbacks?: StreamCallbacks
  ): Promise<{ content: string; toolCalls?: any[] }> {
    if (!this.openaiClient) throw new Error('OpenAI client not initialized');

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      model: this.config.model,
      messages: messages as any,
      temperature: this.config.temperature,
      max_tokens: this.config.max_tokens || undefined,
      stream: true,
    };

    if (tools.length > 0) {
      params.tools = tools as any;
    }

    const stream = await this.openaiClient.chat.completions.create(params);

    let fullContent = '';
    const toolCalls: any[] = [];
    const toolCallsMap = new Map<number, any>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        fullContent += delta.content;
        callbacks?.onChunk?.(delta.content, fullContent);
      }

      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          const index = toolCall.index;

          if (!toolCallsMap.has(index)) {
            toolCallsMap.set(index, {
              id: toolCall.id || '',
              type: 'function',
              function: {
                name: toolCall.function?.name || '',
                arguments: toolCall.function?.arguments || '',
              },
            });
          } else {
            const existing = toolCallsMap.get(index);
            if (toolCall.function?.name) {
              existing.function.name += toolCall.function.name;
            }
            if (toolCall.function?.arguments) {
              existing.function.arguments += toolCall.function.arguments;
            }
            if (toolCall.id) {
              existing.id = toolCall.id;
            }
          }
        }
      }

      // Check finish reason
      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        // Convert map to array
        toolCallsMap.forEach(tc => toolCalls.push(tc));
      }
    }

    return { content: fullContent, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }

  private async handleAnthropicStream(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    _sessionId: string,
    callbacks?: StreamCallbacks
  ): Promise<{ content: string; toolCalls?: any[] }> {
    if (!this.anthropicClient) throw new Error('Anthropic client not initialized');

    // Convert messages to Anthropic format
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content || (m.tool_call_id ? JSON.stringify({ tool_call_id: m.tool_call_id, result: m.content }) : ''),
      }));

    const params: any = {
      model: this.config.model,
      max_tokens: this.config.max_tokens || 4096,
      messages: anthropicMessages,
      temperature: this.config.temperature,
      stream: true,
    };

    if (tools.length > 0) {
      // Convert OpenAI tool format to Anthropic format
      params.tools = tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const stream = await this.anthropicClient.messages.create(params);

    let fullContent = '';
    const toolCalls: any[] = [];

    for await (const event of stream as any) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullContent += event.delta.text;
        callbacks?.onChunk?.(event.delta.text, fullContent);
      }

      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        toolCalls.push({
          id: event.content_block.id,
          type: 'function',
          function: {
            name: event.content_block.name,
            arguments: JSON.stringify(event.content_block.input),
          },
        });
      }
    }

    return { content: fullContent, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }

  private async handleBasicStream(
    _messages: LLMMessage[],
    _callbacks?: StreamCallbacks
  ): Promise<string> {
    // Fallback for providers without native tool support
    // This would use the old text-based command parsing
    throw new Error('Provider not yet implemented with streaming');
  }

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

  private convertMessagesToLLMFormat(messages: Message[]): LLMMessage[] {
    return messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));
  }
}
