import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import InputBox from "@/components/app/input-box";
import { FaUser, FaRobot, FaCopy, FaThumbsUp, FaThumbsDown } from "react-icons/fa";
import { Button } from "@/components/ui/button";

interface Message {
    id: string;
    content: string;
    role: "user" | "assistant";
    timestamp: Date;
}

export default function HomePage() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            content: "Hello! How can I help you today?",
            role: "user",
            timestamp: new Date()
        },
        {
            id: "2",
            content: "Hello! How can I help you today?",
            role: "assistant",
            timestamp: new Date()
        }
    ]);

    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages are added
    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // You could add a toast notification here
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
    };

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Header */}
            <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
                <div className="flex items-center justify-between p-4">
                    <div>
                        <h1 className="text-xl font-semibold">Chat</h1>
                        <p className="text-sm text-muted-foreground">
                            {messages.length > 1 ? `${messages.length - 1} messages` : "Start a conversation"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                            Clear Chat
                        </Button>
                        <Button variant="outline" size="sm">
                            Export
                        </Button>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 relative">
                <ScrollArea ref={scrollAreaRef} className="h-full">
                    <div className="max-w-4xl mx-auto p-4 pb-32">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`mb-6 flex gap-4 ${
                                    message.role === "user" ? "justify-end" : "justify-start"
                                }`}
                            >
                                {message.role === "assistant" && (
                                    <div className="flex-shrink-0">
                                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                                            <FaRobot size={16} className="text-primary-foreground" />
                                        </div>
                                    </div>
                                )}

                                <div className={`flex flex-col ${
                                    message.role === "user" ? "items-end" : "items-start"
                                }`}>
                                    <div
                                        className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                                            message.role === "user"
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted"
                                        }`}
                                    >
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                            {message.content}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs text-muted-foreground">
                                            {formatTime(message.timestamp)}
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
            <InputBox />
        </div>
    );
}
