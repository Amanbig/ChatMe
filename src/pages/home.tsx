import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import InputBox from "@/components/app/input-box";
import MessageItem from "@/components/app/message-item";
import StreamingMessageItem from "@/components/app/streaming-message-item";
import AgentMode from "../components/app/agent-mode";
import { FaRobot, FaCog } from "react-icons/fa";
import { toast } from "sonner";
import { getMessages, sendAiMessageStreaming, createMessage } from "@/lib/api";
import { handleAgentQuery, isAgentQuery } from "@/lib/agent-utils";
import { useAgent } from "@/contexts/AgentContext";
import type { Message, StreamingMessage } from "@/lib/types";
import { listen } from '@tauri-apps/api/event';

export default function HomePage() {
    const { chatId } = useParams<{ chatId: string }>();
    const { isAgentActive, workingDirectory, setAgentActive } = useAgent();
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
            unlistenStreamingComplete = await listen('streaming_complete', () => {
                // Just clear the streaming message and stop generating state
                setStreamingMessage(null);
                setIsGenerating(false);
            });

            // Listen for final message created
            unlistenFinalMessageCreated = await listen('final_message_created', (event: any) => {
                const message = event.payload as Message;
                if (message.chat_id === chatId) {
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
            
            // Check if agent mode is active and if this is an agent query
            if (isAgentActive && isAgentQuery(content.trim())) {
                console.log('Handling agent query:', content.trim());
                
                // Create user message first
                const userMessage = await createMessage({
                    chat_id: chatId,
                    content: content.trim(),
                    role: 'user',
                    images
                });
                
                // Add user message to state
                setMessages(prev => [...prev, userMessage]);
                
                // Handle the query with agent
                const agentResponse = await handleAgentQuery(content.trim(), workingDirectory);
                
                if (agentResponse) {
                    // Create assistant message with agent response
                    const assistantMessage = await createMessage({
                        chat_id: chatId,
                        content: agentResponse,
                        role: 'assistant'
                    });
                    
                    // Add assistant message to state
                    setMessages(prev => [...prev, assistantMessage]);
                    setIsGenerating(false);
                } else {
                    // Fallback to AI if agent can't handle it
                    await sendAiMessageStreaming(chatId, content.trim(), images);
                }
            } else {
                // Send message with streaming (normal AI flow)
                await sendAiMessageStreaming(chatId, content.trim(), images);
            }
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
                    <FaRobot size={48} className="text-muted-foreground mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Welcome to ChatMe</h2>
                    <p className="text-muted-foreground mb-4">Select a chat from the sidebar or create a new one to get started.</p>
                    
                    {/* Agent Mode Panel */}
                    <div className="max-w-md mx-auto">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <FaCog className="h-4 w-4" />
                                    Configure Agent Mode
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="w-full sm:max-w-md">
                                <SheetHeader>
                                    <SheetTitle>Agent Mode Configuration</SheetTitle>
                                    <SheetDescription>
                                        Set up AI agent capabilities for file operations and system interactions.
                                    </SheetDescription>
                                </SheetHeader>
                                <div className="mt-6">
                                    <AgentMode />
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
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
                                    <FaRobot size={32} className="text-muted-foreground mx-auto mb-2" />
                                    <p className="text-muted-foreground mb-4">No messages yet. Start the conversation!</p>
                                    
                                    {/* Agent Mode Access */}
                                    <Sheet>
                                        <SheetTrigger asChild>
                                            <Button variant="outline" size="sm" className="gap-2">
                                                <FaCog className="h-4 w-4" />
                                                Agent Mode
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent className="w-full sm:max-w-md">
                                            <SheetHeader>
                                                <SheetTitle>Agent Mode</SheetTitle>
                                                <SheetDescription>
                                                    AI agent capabilities for this chat.
                                                </SheetDescription>
                                            </SheetHeader>
                                            <div className="mt-6">
                                                {/* <AgentMode 
                                                    chatId={chatId} 
                                                    onSendMessage={handleSendMessage}
                                                /> */}
                                            </div>
                                        </SheetContent>
                                    </Sheet>
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

            {/* Input Box - Fixed at bottom with proper spacing */}
            <div className="flex-shrink-0">
                {/* Agent Mode Toggle Bar */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-muted/20">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <FaRobot className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Agent Mode</span>
                            {isAgentActive && <Badge variant="default" className="text-xs">Active</Badge>}
                        </div>
                        <Switch
                            checked={isAgentActive}
                            onCheckedChange={(checked) => {
                                setAgentActive(checked);
                                toast.info(checked ? "Agent mode enabled" : "Agent mode disabled");
                            }}
                            className="scale-75"
                        />
                    </div>
                    {isAgentActive && (
                        <div className="text-xs text-muted-foreground">
                            Working dir: {workingDirectory || "Not set"}
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-2 px-4 py-2 border-t border-border/50">
                    <div className="flex-1">
                        <InputBox onSendMessage={handleSendMessage} disabled={isGenerating} />
                    </div>
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-2 shrink-0">
                                <FaCog className="h-4 w-4" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent className="w-full sm:max-w-md">
                            <SheetHeader>
                                <SheetTitle>Agent Mode</SheetTitle>
                                <SheetDescription>
                                    AI agent capabilities for this chat.
                                </SheetDescription>
                            </SheetHeader>
                            <div className="mt-6">
                                <AgentMode />
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </div>
    );
}
