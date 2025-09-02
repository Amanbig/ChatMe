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
import { getMessages, createMessage } from "@/lib/api";
import type { Message } from "@/lib/types";

export default function HomePage() {
    const { chatId } = useParams<{ chatId: string }>();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);

    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Load messages when chat changes
    useEffect(() => {
        if (chatId) {
            loadMessages();
        } else {
            setMessages([]);
            setLoading(false);
        }
    }, [chatId]);

    // Auto-scroll to bottom when new messages are added
    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

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
        if (!chatId || !content.trim()) return;

        try {
            // Add user message
            const userMessage = await createMessage({
                chat_id: chatId,
                content: content.trim(),
                role: 'user'
            });

            setMessages(prev => [...prev, userMessage]);

            // TODO: Add AI response logic here
            // For now, just add a simple response
            setTimeout(async () => {
                const assistantMessage = await createMessage({
                    chat_id: chatId,
                    content: "I'm a placeholder response. In a real implementation, this would be connected to an AI service like OpenAI's API.",
                    role: 'assistant'
                });
                setMessages(prev => [...prev, assistantMessage]);
            }, 1000);

        } catch (error) {
            console.error('Failed to send message:', error);
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
                            messages.map((message) => (
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
                            ))
                        )}

                        {/* Typing indicator (when AI is responding) */}
                        {false && (
                            <div className="flex gap-4 justify-start mb-6">
                                <div className="flex-shrink-0">
                                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                                        <FaRobot size={16} className="text-primary-foreground" />
                                    </div>
                                </div>
                                <div className="bg-muted rounded-2xl px-4 py-3">
                                    <div className="flex space-x-1">
                                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Input Box - Fixed at bottom */}
            <InputBox onSendMessage={handleSendMessage} />
        </div>
    );
}
