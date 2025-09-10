import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router";
import { ScrollArea } from "@/components/ui/scroll-area";
import InputBox from "@/components/app/input-box";
import MessageItem from "@/components/app/message-item";
import StreamingMessageItem from "@/components/app/streaming-message-item";
import { toast } from "sonner";
import { getMessages, sendAiMessageStreaming, createMessage } from "@/lib/api";
import { handleAgentQuery, getAvailableAgentTools, parseAndExecuteCommands } from "@/lib/agent-utils";
import { useAgent } from "@/contexts/AgentContext";
import type { Message, StreamingMessage } from "@/lib/types";
import { listen } from '@tauri-apps/api/event';

export default function HomePage() {
    const { chatId } = useParams<{ chatId: string }>();
    const { isAgentActive, workingDirectory } = useAgent();
    const [messages, setMessages] = useState<Message[]>([]);
    const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Speech settings from localStorage
    const [autoSpeak] = useState(() => {
        const saved = localStorage.getItem('autoSpeak');
        return saved ? JSON.parse(saved) : false;
    });

    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Load messages when chat changes
    useEffect(() => {
        if (chatId) {
            loadMessages();
        } else {
            setMessages([]);
            setStreamingMessage(null);
            setLoading(false);
        }
    }, [chatId]);

    // Auto-scroll to bottom when new messages are added or streaming updates
    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages, streamingMessage]);

    // Set up event listeners for streaming
    useEffect(() => {
        let unlistenMessageCreated: (() => void) | null = null;
        let unlistenStreamingStart: (() => void) | null = null;
        let unlistenStreamingChunk: (() => void) | null = null;
        let unlistenStreamingComplete: (() => void) | null = null;
        let unlistenFinalMessageCreated: (() => void) | null = null;

        const setupListeners = async () => {
            // Listen for new messages (user messages)
            unlistenMessageCreated = await listen('message_created', (event: any) => {
                const message = event.payload as Message;
                if (message.chat_id === chatId) {
                    // Filter out enhanced agent messages (they contain agent instructions)
                    if (message.role === 'user' && message.content.includes('[AGENT MODE ACTIVE]')) {
                        // This is an enhanced message with agent instructions, skip it
                        // and create a clean user message instead
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
                        // Check if message already exists to prevent duplicates
                        const exists = prev.some(m => m.id === message.id);
                        if (!exists) {
                            return [...prev, message];
                        }
                        return prev;
                    });
                }
            });

            // Listen for streaming start
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

            // Listen for streaming chunks
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

            // Listen for streaming complete
            unlistenStreamingComplete = await listen('streaming_complete', async () => {
                // If agent mode is active and there's a streaming message, process agent commands
                if (isAgentActive && streamingMessage) {
                    try {
                        const processedContent = await parseAndExecuteCommands(streamingMessage.content);
                        
                        // Update the streaming message with processed content
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
                
                // Clear the streaming message and stop generating state
                setStreamingMessage(null);
                setIsGenerating(false);
            });

            // Listen for final message created
            unlistenFinalMessageCreated = await listen('final_message_created', async (event: any) => {
                const message = event.payload as Message;
                if (message.chat_id === chatId) {
                    // If agent mode is active and this is an assistant message, process agent commands
                    if (isAgentActive && message.role === 'assistant') {
                        try {
                            const processedContent = await parseAndExecuteCommands(message.content);
                            
                            // Update the message content if commands were processed
                            if (processedContent !== message.content) {
                                const updatedMessage = { ...message, content: processedContent };
                                setMessages(prev => {
                                    const exists = prev.some(m => m.id === message.id);
                                    if (!exists) {
                                        return [...prev, updatedMessage];
                                    } else {
                                        return prev.map(m => m.id === message.id ? updatedMessage : m);
                                    }
                                });
                                return;
                            }
                        } catch (error) {
                            console.error('Error processing agent commands:', error);
                            toast.error('Failed to execute agent commands');
                        }
                    }
                    
                    setMessages(prev => {
                        // Check if message already exists to prevent duplicates
                        const exists = prev.some(m => m.id === message.id);
                        if (!exists) {
                            return [...prev, message];
                        }
                        return prev;
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
        };
    }, [chatId]);

    const loadMessages = async () => {
        if (!chatId) return;

        try {
            setLoading(true);
            const fetchedMessages = await getMessages(chatId);
            setMessages(fetchedMessages);
        } catch (error) {
            console.error('Failed to load messages:', error);
            toast.error('Failed to load messages. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (content: string, images?: string[]) => {
        if (!chatId || (!content.trim() && !images?.length) || isGenerating) return;

        try {
            setIsGenerating(true);
            
            // Try basic agent queries first (fallback for very simple operations)
            const agentResponse = await handleAgentQuery(content.trim(), workingDirectory);
            
            if (agentResponse) {
                // Create user message first with original content
                const userMessage = await createMessage({
                    chat_id: chatId,
                    content: content.trim(),
                    role: 'user',
                    images
                });
                
                // Add user message to state
                setMessages(prev => [...prev, userMessage]);
                
                // Create assistant message with agent response
                const assistantMessage = await createMessage({
                    chat_id: chatId,
                    content: agentResponse,
                    role: 'assistant'
                });
                
                // Add assistant message to state
                setMessages(prev => [...prev, assistantMessage]);
                setIsGenerating(false);
                return;
            }
            
            // Prepare message for LLM - enhance only if agent mode is active
            let messageForLLM = content.trim();
            if (isAgentActive) {
                const toolsInfo = await getAvailableAgentTools();
                messageForLLM = `${content.trim()}\n\n[AGENT MODE ACTIVE]
You are an AI assistant with access to Tauri commands. Execute appropriate commands based on user requests.

${toolsInfo}

Working Directory: ${workingDirectory || 'Use get_current_directory() to find current location'}

Respond with commands and helpful information.`;
            }
            
            // sendAiMessageStreaming creates the user message, so we don't create it separately
            // This prevents duplication and ensures only the original user message is saved
            await sendAiMessageStreaming(chatId, messageForLLM, images);
            
        } catch (error) {
            console.error('Failed to send message:', error);
            setIsGenerating(false);
            setStreamingMessage(null);
            toast.error('Failed to send message. Please check your configuration and try again.');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success('Message copied to clipboard');
        }).catch(() => {
            toast.error('Failed to copy message');
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

    if (!chatId) {
        return (
            <div className="flex flex-col h-full bg-background items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">Welcome to ChatMe</h2>
                    <p className="text-muted-foreground mb-4">Select a chat from the sidebar or create a new one to get started.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Messages Area with proper scroll */}
            <div className="flex-1 min-h-0 relative">
                <ScrollArea ref={scrollAreaRef} className="h-full">
                    <div className="max-w-6xl mx-auto p-4 pb-6">
                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <div className="text-muted-foreground">Loading messages...</div>
                            </div>
                        ) : messages.length === 0 && !streamingMessage ? (
                            <div className="flex items-center justify-center min-h-[60vh]">
                                <div className="text-center">
                                    <p className="text-muted-foreground mb-4">No messages yet. Start the conversation!</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {messages.map((message) => (
                                    <MessageItem
                                        key={message.id}
                                        message={message}
                                        formatTime={formatTime}
                                        copyToClipboard={copyToClipboard}
                                        autoSpeak={autoSpeak}
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

            {/* Input Box - Fixed at bottom */}
            <div className="flex-shrink-0">
                <div className="flex items-center gap-2 px-4 py-2 border-t border-border/50">
                    <div className="flex-1">
                        <InputBox onSendMessage={handleSendMessage} disabled={isGenerating} />
                    </div>
                </div>
            </div>
        </div>
    );
}
