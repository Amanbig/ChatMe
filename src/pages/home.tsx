import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import InputBox from "@/components/app/input-box";
import MessageItem from "@/components/app/message-item";
import StreamingMessageItem from "@/components/app/streaming-message-item";
import { toast } from "sonner";
import { getMessages, createMessage, getChat, getDefaultApiConfig, getApiConfig, createToolExecution, getToolExecutionsForMessages } from "@/lib/api";
import { handleAgentQuery, parseAndExecuteCommands } from "@/lib/agent-utils";
import { useAgent } from "@/contexts/AgentContext";
import type { Message, StreamingMessage, ToolExecution, ApiConfig } from "@/lib/types";
import { LLMClient } from "@/lib/llm-client";
import { listen } from '@tauri-apps/api/event';
import { Download } from 'lucide-react';
import { exportChatToMarkdown, exportChatToJson } from '@/lib/export-utils';
import {
    FaRobot,
    FaLightbulb,
    FaCode,
    FaBolt,
    FaRocket,
    FaBrain,
    FaComments
} from "react-icons/fa";

// Welcome screen component
function WelcomeScreen({ onSuggestion }: { onSuggestion: (text: string) => void }) {
    const [activeCategory, setActiveCategory] = useState<'all' | 'code' | 'agent' | 'research'>('all');

    const suggestions = [
        {
            category: 'code',
            icon: <FaCode size={18} />,
            title: "Code Architecture & Refactor",
            text: "Review project codebase structure, identify memory bottlenecks, and suggest clean refactorings",
            color: "from-blue-500 to-indigo-600"
        },
        {
            category: 'agent',
            icon: <FaBolt size={18} />,
            title: "System Diagnostics & Terminal",
            text: "Check git status, list active project files, and inspect workspace diagnostics",
            color: "from-emerald-500 to-teal-600"
        },
        {
            category: 'research',
            icon: <FaBrain size={18} />,
            title: "Documentation & Deep Research",
            text: "Fetch documentation, extract key technical specifications, and summarize actionable insights",
            color: "from-purple-500 to-pink-600"
        },
        {
            category: 'all',
            icon: <FaLightbulb size={18} />,
            title: "Autonomous Agent Team",
            text: "Decompose a multi-step objective and coordinate specialized planner, coder, and reviewer subagents",
            color: "from-amber-500 to-orange-600"
        },
    ];

    const filtered = activeCategory === 'all' 
        ? suggestions 
        : suggestions.filter(s => s.category === activeCategory || s.category === 'all');

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-8">
            {/* Hero */}
            <div className="text-center mb-8 max-w-xl">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-accent shadow-xl shadow-primary/25 mb-5 ring-4 ring-primary/10 animate-in zoom-in-95 duration-300">
                    <FaRobot size={38} className="text-primary-foreground" />
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight mb-2.5 bg-gradient-to-r from-foreground via-foreground/90 to-foreground/60 bg-clip-text text-transparent">
                    What can we build together?
                </h1>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
                    Your desktop AI partner with multi-agent coordination, direct terminal execution, and deep app integrations.
                </p>

                {/* Categories Pill Switcher */}
                <div className="flex items-center justify-center gap-1.5 mt-5 p-1 rounded-full bg-muted/60 border border-border/50 max-w-xs mx-auto text-xs">
                    <button
                        onClick={() => setActiveCategory('all')}
                        className={`px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                            activeCategory === 'all' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Featured
                    </button>
                    <button
                        onClick={() => setActiveCategory('code')}
                        className={`px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                            activeCategory === 'code' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Coding
                    </button>
                    <button
                        onClick={() => setActiveCategory('agent')}
                        className={`px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                            activeCategory === 'agent' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Agent
                    </button>
                    <button
                        onClick={() => setActiveCategory('research')}
                        className={`px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                            activeCategory === 'research' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Research
                    </button>
                </div>
            </div>

            {/* Suggestions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-2xl w-full mb-8">
                {filtered.map((suggestion, index) => (
                    <button
                        key={index}
                        onClick={() => onSuggestion(suggestion.text)}
                        className="group flex flex-col justify-between p-4 rounded-xl border border-border/70 bg-card/50 hover:bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left cursor-pointer"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${suggestion.color} flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform duration-200 shrink-0`}>
                                {suggestion.icon}
                            </div>
                            <span className="text-xs font-semibold text-foreground">
                                {suggestion.title}
                            </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {suggestion.text}
                        </p>
                    </button>
                ))}
            </div>

            {/* Badges */}
            <div className="flex flex-wrap justify-center gap-2 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-card/40 border-border/60">
                    <FaBrain size={11} className="text-primary" />
                    Multi-Agent Orchestration
                </Badge>
                <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-card/40 border-border/60">
                    <FaBolt size={11} className="text-emerald-500" />
                    Work with Apps
                </Badge>
                <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-card/40 border-border/60">
                    <FaCode size={11} className="text-blue-500" />
                    Interactive Code Runner
                </Badge>
                <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-card/40 border-border/60">
                    <FaRocket size={11} className="text-purple-500" />
                    Native Streaming
                </Badge>
            </div>
        </div>
    );
}

// Empty chat state
function EmptyChatState() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <FaComments size={28} className="text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground/80 mb-2">Start the conversation</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
                Send a message to begin chatting. I can help with questions, coding, analysis, and more.
            </p>
        </div>
    );
}

export default function HomePage() {
    const { chatId } = useParams<{ chatId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { isAgentActive, workingDirectory } = useAgent();
    const [messages, setMessages] = useState<Message[]>([]);
    const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [toolExecutions, setToolExecutions] = useState<Map<string, ToolExecution[]>>(new Map());
    const hasAutoSentRef = useRef(false);
    const rafIdRef = useRef<number | null>(null);
    const [chatTitle, setChatTitle] = useState<string>('Chat');

    const [autoSpeak] = useState(() => {
        const saved = localStorage.getItem('autoSpeak');
        return saved ? JSON.parse(saved) : false;
    });

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputBoxRef = useRef<{ focus: () => void; insertText: (text: string) => void }>(null);

    // Helper to persist tool executions to database
    const persistToolExecutions = async (messageId: string, executions: ToolExecution[]) => {
        for (let i = 0; i < executions.length; i++) {
            const exec = executions[i];
            try {
                await createToolExecution({
                    message_id: messageId,
                    tool_call_id: exec.tool_call_id,
                    tool_name: exec.tool_name,
                    tool_source: 'builtin', // Will be updated for MCP tools later
                    arguments: exec.arguments,
                    result: exec.result,
                    success: exec.success,
                    error_message: exec.error_message,
                    execution_order: i,
                    started_at: exec.timestamp,
                    completed_at: new Date().toISOString(),
                });
            } catch (error) {
                console.error('Failed to persist tool execution:', error);
                // Non-fatal - continue with other executions
            }
        }
    };

    useEffect(() => {
        // Reset auto-send flag when chatId changes (new chat or returning to home)
        hasAutoSentRef.current = false;

        if (chatId) {
            loadMessages();
        } else {
            setMessages([]);
            setStreamingMessage(null);
            setLoading(false);
        }
    }, [chatId]);

    // Listen for permission messages created by the backend
    useEffect(() => {
        if (!chatId) return;

        const setupListener = async () => {
            const unlisten = await listen<Message>('permission_message_created', (event) => {
                console.log('Permission message received:', event.payload);

                // Only add if it's for the current chat
                if (event.payload.chat_id === chatId) {
                    setMessages(prev => {
                        // Check if message already exists
                        const exists = prev.some(m => m.id === event.payload.id);
                        if (!exists) {
                            return [...prev, event.payload];
                        }
                        return prev;
                    });
                }
            });

            return unlisten;
        };

        const listenerPromise = setupListener();

        return () => {
            listenerPromise.then(unlisten => unlisten());
        };
    }, [chatId]);

    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages, streamingMessage]);

    useEffect(() => {
        let unlistenMessageCreated: (() => void) | null = null;
        let unlistenStreamingStart: (() => void) | null = null;
        let unlistenStreamingChunk: (() => void) | null = null;
        let unlistenStreamingComplete: (() => void) | null = null;
        let unlistenFinalMessageCreated: (() => void) | null = null;
        let unlistenToolExecutionComplete: (() => void) | null = null;

        const setupListeners = async () => {
            // Tool execution listener
            unlistenToolExecutionComplete = await listen('tool_execution_complete', (event: any) => {
                const { message_id, execution } = event.payload;
                setToolExecutions(prev => {
                    const newMap = new Map(prev);
                    const existing = newMap.get(message_id) || [];
                    newMap.set(message_id, [...existing, execution as ToolExecution]);
                    return newMap;
                });
            });
            unlistenMessageCreated = await listen('message_created', (event: any) => {
                const message = event.payload as Message;
                if (message.chat_id === chatId) {
                    if (message.role === 'user' && message.content.includes('[AGENT MODE ACTIVE]')) {
                        const cleanContent = message.content.split('\n\n[AGENT MODE ACTIVE]')[0];
                        const cleanMessage = { ...message, content: cleanContent };

                        setMessages(prev => {
                            const exists = prev.some(m => m.id === message.id);
                            if (!exists) {
                                return [...prev, cleanMessage];
                            }
                            return prev;
                        });
                        return;
                    }

                    setMessages(prev => {
                        const exists = prev.some(m => m.id === message.id);
                        if (!exists) {
                            return [...prev, message];
                        }
                        return prev;
                    });
                }
            });

            unlistenStreamingStart = await listen('streaming_start', (event: any) => {
                const { message_id } = event.payload;
                setStreamingMessage({
                    id: message_id,
                    content: '',
                    isStreaming: true,
                    isComplete: false
                });
                setIsGenerating(true);
            });

            unlistenStreamingChunk = await listen('streaming_chunk', (event: any) => {
                const { message_id, full_content } = event.payload;
                setStreamingMessage(prev => {
                    if (prev && prev.id === message_id) {
                        return {
                            ...prev,
                            content: full_content,
                            isStreaming: true,
                            isComplete: false
                        };
                    }
                    return prev;
                });
            });

            unlistenStreamingComplete = await listen('streaming_complete', async () => {
                if (isAgentActive && streamingMessage) {
                    try {
                        const processedContent = await parseAndExecuteCommands(streamingMessage.content);
                        setStreamingMessage(prev => prev ? {
                            ...prev,
                            content: processedContent,
                            isComplete: true
                        } : null);
                    } catch (error) {
                        console.error('Error processing agent commands:', error);
                        toast.error('Failed to execute agent commands');
                    }
                }

                setStreamingMessage(null);
                setIsGenerating(false);
            });

            unlistenFinalMessageCreated = await listen('final_message_created', async (event: any) => {
                const { message } = event.payload;

                if (message.chat_id === chatId) {
                    let finalMessage = message;

                    if (isAgentActive && message.role === 'assistant') {
                        try {
                            const processedContent = await parseAndExecuteCommands(message.content);
                            if (processedContent !== message.content) {
                                finalMessage = { ...message, content: processedContent };
                            }
                        } catch (error) {
                            console.error('Error processing agent commands:', error);
                            toast.error('Failed to execute agent commands');
                        }
                    }

                    if (finalMessage.role === 'assistant' && finalMessage.content.includes('[EXECUTE:')) {
                        const lines = finalMessage.content.split('\n').filter((line: string) => line.trim());
                        const executeLines = lines.filter((line: string) => line.includes('[EXECUTE:'));
                        const nonExecuteLines = lines.filter((line: string) => !line.includes('[EXECUTE:') && line.trim().length > 0);

                        if (executeLines.length > 0 && (nonExecuteLines.length === 0 || executeLines.length >= lines.length * 0.8)) {
                            return;
                        }

                        if (executeLines.length > 0 && nonExecuteLines.length > 0) {
                            const cleanContent = lines.filter((line: string) => !line.includes('[EXECUTE:')).join('\n').trim();
                            if (cleanContent.length > 0) {
                                finalMessage = { ...finalMessage, content: cleanContent };
                            } else {
                                return;
                            }
                        }
                    }

                    setMessages(prev => {
                        const exists = prev.some(m => m.id === finalMessage.id);
                        if (!exists) {
                            return [...prev, finalMessage];
                        } else {
                            return prev.map(m => m.id === finalMessage.id ? finalMessage : m);
                        }
                    });
                }
            });
        };

        if (chatId) {
            setupListeners();
        }

        return () => {
            unlistenMessageCreated?.();
            unlistenStreamingStart?.();
            unlistenStreamingChunk?.();
            unlistenStreamingComplete?.();
            unlistenFinalMessageCreated?.();
            unlistenToolExecutionComplete?.();
        };
    }, [chatId]);

    const loadMessages = async () => {
        if (!chatId) return;

        try {
            setLoading(true);
            const [fetchedMessages, chatData] = await Promise.all([
                getMessages(chatId),
                getChat(chatId)
            ]);
            if (chatData?.title) {
                setChatTitle(chatData.title);
            }

            const displayMessages = fetchedMessages.map(message => {
                // Filter out permission request system messages - they're ephemeral like tool executions
                if (message.role === 'system' && message.permission_request_id) {
                    return null;
                }

                if (message.role === 'user' && message.content.includes('[AGENT MODE ACTIVE]')) {
                    const cleanContent = message.content.split('\n\n[AGENT MODE ACTIVE]')[0].trim();
                    if (cleanContent.length > 0) {
                        return { ...message, content: cleanContent };
                    }
                    return null;
                }

                if (message.role === 'assistant' && message.content.includes('[EXECUTE:')) {
                    const lines = message.content.split('\n').filter(line => line.trim());
                    const executeLines = lines.filter(line => line.includes('[EXECUTE:'));
                    const nonExecuteLines = lines.filter(line => !line.includes('[EXECUTE:') && line.trim().length > 0);

                    if (executeLines.length > 0 && (nonExecuteLines.length === 0 || executeLines.length >= lines.length * 0.8)) {
                        return null;
                    }

                    if (executeLines.length > 0 && nonExecuteLines.length > 0) {
                        const cleanContent = lines.filter(line => !line.includes('[EXECUTE:')).join('\n').trim();
                        if (cleanContent.length > 0) {
                            return { ...message, content: cleanContent };
                        }
                        return null;
                    }
                }

                return message;
            }).filter(message => message !== null);

            setMessages(displayMessages);

            // Load tool executions from database for all messages
            const messageIds = displayMessages.map(m => m.id);
            if (messageIds.length > 0) {
                try {
                    const executionsMap = await getToolExecutionsForMessages(messageIds);
                    // Convert database records to ToolExecution format for display
                    const newToolExecutions = new Map<string, ToolExecution[]>();
                    for (const [msgId, records] of Object.entries(executionsMap)) {
                        newToolExecutions.set(msgId, records.map(record => ({
                            tool_call_id: record.tool_call_id,
                            tool_name: record.tool_name,
                            arguments: record.arguments,
                            result: record.result,
                            success: record.success,
                            error_message: record.error_message,
                            timestamp: record.started_at,
                        })));
                    }
                    setToolExecutions(newToolExecutions);
                } catch (error) {
                    console.error('Failed to load tool executions:', error);
                    // Non-fatal - just don't show tool executions
                }
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
            toast.error('Failed to load messages. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    };

    // Auto-send LLM response when coming from welcome screen
    useEffect(() => {
        const autoSendMessage = async () => {
            const locationState = location.state as { autoSend?: boolean } | null;

            if (!chatId || !locationState?.autoSend || hasAutoSentRef.current || loading || isGenerating) {
                return;
            }

            hasAutoSentRef.current = true;

            // Clear the navigation state to prevent re-triggering
            navigate(location.pathname, { replace: true, state: {} });

            try {
                setIsGenerating(true);

                // Get API config for this chat
                const chat = await getChat(chatId);
                let apiConfig: ApiConfig | null = null;

                if (chat?.api_config_id) {
                    apiConfig = await getApiConfig(chat.api_config_id);
                } else {
                    apiConfig = await getDefaultApiConfig();
                }

                if (!apiConfig) {
                    throw new Error('No API configuration found. Please set up an API configuration in Settings.');
                }

                // Create LLM client
                const llmClient = new LLMClient(apiConfig);

                // Get all messages for context
                const allMessages = await getMessages(chatId);

                // Setup streaming message
                let streamingId = `streaming-${Date.now()}`;
                setStreamingMessage({
                    id: streamingId,
                    content: '',
                    isStreaming: true,
                    isComplete: false,
                });

                // Track saved executions to avoid duplicates
                const savedExecutions = new Set<string>();

                // Track current streaming content using ref to avoid stale closure
                const currentContentRef = { current: '' };

                // Send message with streaming (CLI-style iterations)
                await llmClient.sendMessageStreaming(
                    chatId,
                    allMessages,
                    isAgentActive,
                    {
                        onChunk: (_chunk, fullContent) => {
                            currentContentRef.current = fullContent;
                            if (rafIdRef.current === null) {
                                rafIdRef.current = requestAnimationFrame(() => {
                                    setStreamingMessage({
                                        id: streamingId,
                                        content: currentContentRef.current,
                                        isStreaming: true,
                                        isComplete: false,
                                    });
                                    rafIdRef.current = null;
                                });
                            }
                        },
                        onToolExecution: async (execution) => {
                            // Get current streaming content from ref
                            const currentContent = currentContentRef.current;

                            // If there's reasoning text, save it as an intermediate message
                            if (currentContent.trim()) {
                                const intermediateMessage = await createMessage({
                                    chat_id: chatId,
                                    content: currentContent,
                                    role: 'assistant',
                                });

                                // Save tool execution for this intermediate message
                                setToolExecutions(prev => {
                                    const newMap = new Map(prev);
                                    newMap.set(intermediateMessage.id, [execution]);
                                    return newMap;
                                });

                                // Persist to database
                                await persistToolExecutions(intermediateMessage.id, [execution]);

                                savedExecutions.add(execution.tool_call_id);

                                // Add message to display
                                setMessages(prev => [...prev, intermediateMessage]);

                                // Reset streaming for next iteration
                                currentContentRef.current = '';
                                streamingId = `streaming-${Date.now()}-${execution.tool_call_id}`;
                                setStreamingMessage({
                                    id: streamingId,
                                    content: '',
                                    isStreaming: true,
                                    isComplete: false,
                                });
                            } else {
                                // No reasoning text yet, accumulate tool executions
                                setToolExecutions(prev => {
                                    const newMap = new Map(prev);
                                    const existing = newMap.get(streamingId) || [];
                                    newMap.set(streamingId, [...existing, execution]);
                                    return newMap;
                                });
                                savedExecutions.add(execution.tool_call_id);
                            }
                        },
                        onComplete: async (content, allExecutions) => {
                            if (rafIdRef.current !== null) {
                                cancelAnimationFrame(rafIdRef.current);
                                rafIdRef.current = null;
                            }
                            // Filter out already-saved executions
                            const remainingExecutions = allExecutions.filter(
                                exec => !savedExecutions.has(exec.tool_call_id)
                            );

                            // Save final assistant message if there's content
                            if (content.trim()) {
                                const assistantMessage = await createMessage({
                                    chat_id: chatId,
                                    content: content,
                                    role: 'assistant',
                                });

                                // Add remaining tool executions to final message
                                if (remainingExecutions.length > 0) {
                                    setToolExecutions(prev => {
                                        const newMap = new Map(prev);
                                        newMap.delete(streamingId);
                                        newMap.set(assistantMessage.id, remainingExecutions);
                                        return newMap;
                                    });

                                    // Persist to database
                                    await persistToolExecutions(assistantMessage.id, remainingExecutions);
                                }

                                // Update messages
                                setMessages(prev => [...prev, assistantMessage]);
                            }

                            setStreamingMessage(null);
                            setIsGenerating(false);
                        }
                    }
                );
            } catch (error) {
                console.error('Failed to auto-send message:', error);
                setIsGenerating(false);
                setStreamingMessage(null);
                toast.error(error instanceof Error ? error.message : 'Failed to send message. Please try again.');
            }
        };

        if (!loading) {
            autoSendMessage();
        }
    }, [chatId, loading, location.state]);

    const handleSendMessage = async (content: string, images?: string[]) => {
        if (!chatId || (!content.trim() && !images?.length) || isGenerating) return;

        try {
            setIsGenerating(true);

            const agentResponse = await handleAgentQuery(content.trim(), workingDirectory);

            if (agentResponse) {
                const userMessage = await createMessage({
                    chat_id: chatId,
                    content: content.trim(),
                    role: 'user',
                    images
                });

                setMessages(prev => [...prev, userMessage]);

                const assistantMessage = await createMessage({
                    chat_id: chatId,
                    content: agentResponse,
                    role: 'assistant'
                });

                setMessages(prev => [...prev, assistantMessage]);
                setIsGenerating(false);
                return;
            }

            // Create user message in database
            const userMessage = await createMessage({
                chat_id: chatId,
                content: content.trim(),
                role: 'user',
                images
            });

            setMessages(prev => [...prev, userMessage]);

            // Get API config for this chat
            const chat = await getChat(chatId);
            let apiConfig: ApiConfig | null = null;

            if (chat?.api_config_id) {
                apiConfig = await getApiConfig(chat.api_config_id);
            } else {
                apiConfig = await getDefaultApiConfig();
            }

            if (!apiConfig) {
                throw new Error('No API configuration found. Please set up an API configuration in Settings.');
            }

            // Create LLM client
            const llmClient = new LLMClient(apiConfig);

            // Get all messages for context
            const allMessages = await getMessages(chatId);

            // Setup streaming message
            let streamingId = `streaming-${Date.now()}`;
            setStreamingMessage({
                id: streamingId,
                content: '',
                isStreaming: true,
                isComplete: false,
            });

            // Track saved executions to avoid duplicates
            const savedExecutions = new Set<string>();

            // Track current streaming content using ref to avoid stale closure
            const currentContentRef = { current: '' };

            // Send message with streaming (CLI-style iterations)
            await llmClient.sendMessageStreaming(
                chatId,
                allMessages,
                isAgentActive, // Use tools if agent mode is active
                {
                    onChunk: (_chunk, fullContent) => {
                        currentContentRef.current = fullContent;
                        if (rafIdRef.current === null) {
                            rafIdRef.current = requestAnimationFrame(() => {
                                setStreamingMessage({
                                    id: streamingId,
                                    content: currentContentRef.current,
                                    isStreaming: true,
                                    isComplete: false,
                                });
                                rafIdRef.current = null;
                            });
                        }
                    },
                    onToolExecution: async (execution) => {
                        // Get current streaming content from ref
                        const currentContent = currentContentRef.current;

                        // If there's reasoning text, save it as an intermediate message
                        if (currentContent.trim()) {
                            const intermediateMessage = await createMessage({
                                chat_id: chatId,
                                content: currentContent,
                                role: 'assistant',
                            });

                            // Save tool execution for this intermediate message
                            setToolExecutions(prev => {
                                const newMap = new Map(prev);
                                newMap.set(intermediateMessage.id, [execution]);
                                return newMap;
                            });

                            // Persist to database
                            await persistToolExecutions(intermediateMessage.id, [execution]);

                            savedExecutions.add(execution.tool_call_id);

                            // Add message to display
                            setMessages(prev => [...prev, intermediateMessage]);

                            // Reset streaming for next iteration
                            currentContentRef.current = '';
                            streamingId = `streaming-${Date.now()}-${execution.tool_call_id}`;
                            setStreamingMessage({
                                id: streamingId,
                                content: '',
                                isStreaming: true,
                                isComplete: false,
                            });
                        } else {
                            // No reasoning text yet, accumulate tool executions
                            setToolExecutions(prev => {
                                const newMap = new Map(prev);
                                const existing = newMap.get(streamingId) || [];
                                newMap.set(streamingId, [...existing, execution]);
                                return newMap;
                            });
                            savedExecutions.add(execution.tool_call_id);
                        }
                    },
                    onComplete: async (content, allExecutions) => {
                        if (rafIdRef.current !== null) {
                            cancelAnimationFrame(rafIdRef.current);
                            rafIdRef.current = null;
                        }
                        // Filter out already-saved executions
                        const remainingExecutions = allExecutions.filter(
                            exec => !savedExecutions.has(exec.tool_call_id)
                        );

                        // Save final assistant message if there's content
                        if (content.trim()) {
                            const assistantMessage = await createMessage({
                                chat_id: chatId,
                                content: content,
                                role: 'assistant',
                            });

                            // Add remaining tool executions to final message
                            if (remainingExecutions.length > 0) {
                                setToolExecutions(prev => {
                                    const newMap = new Map(prev);
                                    newMap.delete(streamingId);
                                    newMap.set(assistantMessage.id, remainingExecutions);
                                    return newMap;
                                });

                                // Persist to database
                                await persistToolExecutions(assistantMessage.id, remainingExecutions);
                            }

                            // Update messages
                            setMessages(prev => [...prev, assistantMessage]);
                        }

                        setStreamingMessage(null);
                        setIsGenerating(false);
                    }
                }
            );

        } catch (error) {
            console.error('Failed to send message:', error);
            setIsGenerating(false);
            setStreamingMessage(null);
            toast.error(error instanceof Error ? error.message : 'Failed to send message. Please check your configuration and try again.');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success('Copied to clipboard');
        }).catch(() => {
            toast.error('Failed to copy');
        });
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    const handleSuggestion = (text: string) => {
        if (inputBoxRef.current) {
            inputBoxRef.current.insertText(text);
            inputBoxRef.current.focus();
        }
    };

    const handlePermissionStatusUpdate = (permissionId: string, status: 'approved' | 'denied') => {
        setMessages(prev => prev.map(msg => {
            if (msg.permission_request?.id === permissionId) {
                return {
                    ...msg,
                    permission_request: {
                        ...msg.permission_request,
                        status,
                        updated_at: new Date().toISOString()
                    }
                };
            }
            return msg;
        }));
    };

    // Welcome screen when no chat selected
    if (!chatId) {
        const handleStartChat = async (content: string, images?: string[]) => {
            if (!content.trim() && !images?.length) return;

            try {
                // Don't set isGenerating here - it will be set by autoSendMessage after navigation
                // This prevents the autoSendMessage effect from being blocked

                // Create a new chat
                const { createChat } = await import('@/lib/api');
                const newChat = await createChat({ title: content.slice(0, 50) || "New Chat" });

                // Create user message immediately
                const userMessage = await createMessage({
                    chat_id: newChat.id,
                    content: content.trim(),
                    role: 'user',
                    images
                });

                // Navigate to the new chat - autoSendMessage effect will handle the LLM response
                navigate(`/chat/${newChat.id}`, {
                    state: { autoSend: true, initialMessage: userMessage.id }
                });

                toast.success('New chat created!');
            } catch (error) {
                console.error('Failed to create chat:', error);
                toast.error('Failed to create chat. Please try again.');
            }
        };

        return (
            <div className="flex flex-col h-full bg-background">
                <WelcomeScreen onSuggestion={handleSuggestion} />
                <div className="flex-shrink-0 px-4 pb-4">
                    <InputBox ref={inputBoxRef} onSendMessage={handleStartChat} disabled={false} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Chat Action Header */}
            <div className="flex items-center justify-between px-6 py-2 border-b border-border/40 bg-background/80 backdrop-blur-sm text-xs">
                <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                    <span className="font-semibold text-foreground truncate max-w-sm">{chatTitle}</span>
                    <span>•</span>
                    <span className="shrink-0">{messages.length} {messages.length === 1 ? 'message' : 'messages'}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => exportChatToMarkdown(chatTitle, messages)}
                        disabled={messages.length === 0}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
                        title="Export conversation as Markdown (.md)"
                    >
                        <Download className="h-3.5 w-3.5" />
                        <span>Markdown</span>
                    </button>
                    <button
                        onClick={() => exportChatToJson(chatTitle, messages)}
                        disabled={messages.length === 0}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
                        title="Export conversation as JSON (.json)"
                    >
                        <Download className="h-3.5 w-3.5" />
                        <span>JSON</span>
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 min-h-0 relative">
                <ScrollArea ref={scrollAreaRef} className="h-full">
                    <div className="max-w-4xl mx-auto">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-4">
                                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                <p className="text-sm text-muted-foreground">Loading messages...</p>
                            </div>
                        ) : messages.length === 0 && !streamingMessage ? (
                            <EmptyChatState />
                        ) : (
                            <div className="space-y-3.5 p-4 sm:p-6 pb-8">
                                {messages.map((message) => (
                                    <MessageItem
                                        key={message.id}
                                        message={message}
                                        formatTime={formatTime}
                                        copyToClipboard={copyToClipboard}
                                        autoSpeak={autoSpeak}
                                        toolExecutions={toolExecutions.get(message.id) || undefined}
                                        onPermissionStatusUpdate={handlePermissionStatusUpdate}
                                    />
                                ))}

                                {streamingMessage && (
                                    <StreamingMessageItem
                                        key={`streaming-${streamingMessage.id}`}
                                        streamingMessage={streamingMessage}
                                        autoSpeak={autoSpeak}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Input Box */}
            <div className="flex-shrink-0">
                <InputBox ref={inputBoxRef} onSendMessage={handleSendMessage} disabled={isGenerating} />
            </div>
        </div>
    );
}
