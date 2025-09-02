import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router";
import { ScrollArea } from "@/components/ui/scroll-area";
import InputBox from "@/components/app/input-box";
import { FaUser, FaRobot, FaCopy, FaThumbsUp, FaThumbsDown } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { getMessages, sendAiMessageStreaming } from "@/lib/api";
import type { Message, StreamingMessage } from "@/lib/types";
import { listen } from '@tauri-apps/api/event';

export default function HomePage() {
    const { chatId } = useParams<{ chatId: string }>();
    const [messages, setMessages] = useState<Message[]>([]);
    const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

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
                    setMessages(prev => [...prev, message]);
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
            unlistenStreamingComplete = await listen('streaming_complete', () => {
                // Just clear the streaming message and stop generating state
                setStreamingMessage(null);
                setIsGenerating(false);
            });

            // Listen for final message created
            unlistenFinalMessageCreated = await listen('final_message_created', (event: any) => {
                const message = event.payload as Message;
                if (message.chat_id === chatId) {
                    setMessages(prev => [...prev, message]);
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
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (content: string) => {
        if (!chatId || !content.trim() || isGenerating) return;

        try {
            setIsGenerating(true);
            // Send message with streaming
            await sendAiMessageStreaming(chatId, content.trim());
        } catch (error) {
            console.error('Failed to send message:', error);
            setIsGenerating(false);
            setStreamingMessage(null);
            // TODO: Show error notification to user
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // You could add a toast notification here
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
                    <FaRobot size={48} className="text-muted-foreground mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Welcome to ChatMe</h2>
                    <p className="text-muted-foreground">Select a chat from the sidebar or create a new one to get started.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Messages Area */}
            <div className="flex-1 relative">
                <ScrollArea ref={scrollAreaRef} className="h-full">
                    <div className="max-w-6xl mx-auto p-4 pb-32">
                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <div className="text-muted-foreground">Loading messages...</div>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex items-center justify-center h-32">
                                <div className="text-center">
                                    <FaRobot size={32} className="text-muted-foreground mx-auto mb-2" />
                                    <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`mb-6 flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"
                                            }`}
                                    >
                                        {message.role === "assistant" && (
                                            <div className="flex-shrink-0">
                                                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                                                    <FaRobot size={16} className="text-primary-foreground" />
                                                </div>
                                            </div>
                                        )}

                                        <div className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"
                                            }`}>
                                            <div
                                                className={`rounded-2xl px-4 py-3 ${message.role === "user"
                                                    ? "max-w-[70%] bg-primary text-primary-foreground"
                                                    : "w-full bg-muted"
                                                    }`}
                                            >
                                                {message.role === "assistant" ? (
                                                    <div className="text-sm markdown-content">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            rehypePlugins={[rehypeHighlight, rehypeRaw]}
                                                            components={{
                                                                code: ({ className, children, ...props }: any) => {
                                                                    const isInline = !className?.includes('language-');
                                                                    return isInline ? (
                                                                        <code className="bg-muted-foreground/20 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                                                                            {children}
                                                                        </code>
                                                                    ) : (
                                                                        <code className={className} {...props}>
                                                                            {children}
                                                                        </code>
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            {message.content}
                                                        </ReactMarkdown>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                                        {message.content}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs text-muted-foreground">
                                                    {formatTime(message.created_at)}
                                                </span>

                                                {message.role === "assistant" && (
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0 hover:bg-muted"
                                                            onClick={() => copyToClipboard(message.content)}
                                                        >
                                                            <FaCopy size={12} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0 hover:bg-muted"
                                                        >
                                                            <FaThumbsUp size={12} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0 hover:bg-muted"
                                                        >
                                                            <FaThumbsDown size={12} />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {message.role === "user" && (
                                            <div className="flex-shrink-0">
                                                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                                                    <FaUser size={16} className="text-muted-foreground" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Streaming Message */}
                                {streamingMessage && (
                                    <div key={`streaming-${streamingMessage.id}`} className="mb-6 flex gap-2 justify-start">
                                        <div className="flex-shrink-0">
                                            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                                                <FaRobot size={16} className="text-primary-foreground" />
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-start">
                                            <div className="w-full bg-muted rounded-2xl px-4 py-3">
                                                <div className="text-sm markdown-content">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        rehypePlugins={[rehypeHighlight, rehypeRaw]}
                                                        components={{
                                                            code: ({ className, children, ...props }: any) => {
                                                                const isInline = !className?.includes('language-');
                                                                return isInline ? (
                                                                    <code className="bg-muted-foreground/20 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                                                                        {children}
                                                                    </code>
                                                                ) : (
                                                                    <code className={className} {...props}>
                                                                        {children}
                                                                    </code>
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        {streamingMessage.content}
                                                    </ReactMarkdown>
                                                    {streamingMessage.isStreaming && (
                                                        <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs text-muted-foreground">
                                                    {streamingMessage.isStreaming ? 'Generating...' : 'Just now'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}


                    </div>
                </ScrollArea>
            </div>

            {/* Input Box - Fixed at bottom */}
            <InputBox onSendMessage={handleSendMessage} disabled={isGenerating} />
        </div>
    );
}
