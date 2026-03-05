import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import InputBox from "@/components/app/input-box";
import MessageItem from "@/components/app/message-item";
import StreamingMessageItem from "@/components/app/streaming-message-item";
import { toast } from "sonner";
import { getMessages, createMessage, getChat, getDefaultApiConfig, getApiConfig } from "@/lib/api";
import { handleAgentQuery, parseAndExecuteCommands } from "@/lib/agent-utils";
import { useAgent } from "@/contexts/AgentContext";
import type { Message, StreamingMessage, ToolExecution, ApiConfig } from "@/lib/types";
import { LLMClient } from "@/lib/llm-client";
import { listen } from '@tauri-apps/api/event';
import {
    FaRobot,
    FaLightbulb,
    FaCode,
    FaImage,
    FaMicrophone,
    FaBolt,
    FaRocket,
    FaBrain,
    FaComments
} from "react-icons/fa";

// Welcome screen component
function WelcomeScreen({ onSuggestion }: { onSuggestion: (text: string) => void }) {
    const suggestions = [
        { icon: <FaLightbulb size={18} />, text: "Help me brainstorm ideas for a project", color: "from-amber-500 to-orange-500" },
        { icon: <FaCode size={18} />, text: "Explain how async/await works in JavaScript", color: "from-blue-500 to-cyan-500" },
        { icon: <FaImage size={18} />, text: "Generate a creative image description", color: "from-purple-500 to-pink-500" },
        { icon: <FaBolt size={18} />, text: "Write a Python script to automate file organization", color: "from-green-500 to-emerald-500" },
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-12">
            {/* Hero */}
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-xl shadow-primary/20 mb-6 animate-in zoom-in-95 duration-300">
                    <FaRobot size={40} className="text-primary-foreground" />
                </div>
                <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    What can I help you with?
                </h1>
                <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
                    Chat with an AI assistant that can answer questions, help with coding,
                    analyze images, and even control your computer with Agent Mode.
                </p>
            </div>

            {/* Suggestions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full mb-10">
                {suggestions.map((suggestion, index) => (
                    <button
                        key={index}
                        onClick={() => onSuggestion(suggestion.text)}
                        className="group flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left"
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${suggestion.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-200`}>
                            {suggestion.icon}
                        </div>
                        <span className="text-sm font-medium text-foreground/90 group-hover:text-foreground">
                            {suggestion.text}
                        </span>
                    </button>
                ))}
            </div>

            {/* Features */}
            <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
                <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
                    <FaBrain size={12} className="text-primary" />
                    Reasoning AI
                </Badge>
                <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
                    <FaImage size={12} className="text-primary" />
                    Vision Support
                </Badge>
                <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
                    <FaMicrophone size={12} className="text-primary" />
                    Voice Input
                </Badge>
                <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
                    <FaRocket size={12} className="text-primary" />
                    Agent Mode
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

    const [autoSpeak] = useState(() => {
        const saved = localStorage.getItem('autoSpeak');
        return saved ? JSON.parse(saved) : false;
    });

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputBoxRef = useRef<{ focus: () => void; insertText: (text: string) => void }>(null);

    useEffect(() => {
        if (chatId) {
            loadMessages();
        } else {
            setMessages([]);
            setStreamingMessage(null);
            setLoading(false);
            hasAutoSentRef.current = false;
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
            const fetchedMessages = await getMessages(chatId);

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
                            setStreamingMessage({
                                id: streamingId,
                                content: fullContent,
                                isStreaming: true,
                                isComplete: false,
                            });
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
                        setStreamingMessage({
                            id: streamingId,
                            content: fullContent,
                            isStreaming: true,
                            isComplete: false,
                        });
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
                setIsGenerating(true);

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

                // Navigate to the new chat
                navigate(`/chat/${newChat.id}`, {
                    state: { autoSend: true, initialMessage: userMessage.id }
                });

                toast.success('New chat created!');
            } catch (error) {
                console.error('Failed to create chat:', error);
                toast.error('Failed to create chat. Please try again.');
                setIsGenerating(false);
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
                            <div className="space-y-6 p-4 pb-8">
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
