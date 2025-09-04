import { useState } from "react";
import { FaUser, FaRobot, FaCopy, FaThumbsUp, FaThumbsDown, FaChevronDown, FaChevronUp, FaBrain } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import type { Message } from "@/lib/types";

interface MessageItemProps {
    message: Message;
    formatTime: (dateString: string) => string;
    copyToClipboard: (text: string) => void;
}

// Parse AI thinking content
const parseAIThinking = (content: string) => {
    // First check for thinking content
    const thinkingRegex = /<\|start\|>assistant<\|channel\|>thinking<\|message\|>([\s\S]*?)<\|start\|>assistant<\|channel\|>final<\|message\|>([\s\S]*?)$/;
    const thinkingMatch = content.match(thinkingRegex);
    
    if (thinkingMatch) {
        return {
            thinking: thinkingMatch[1].trim(),
            final: thinkingMatch[2].trim(),
            hasThinking: true
        };
    }
    
    // Check for final message only (no thinking)
    const finalOnlyRegex = /<\|start\|>assistant<\|channel\|>final<\|message\|>([\s\S]*)$/;
    const finalMatch = content.match(finalOnlyRegex);
    
    if (finalMatch) {
        return {
            thinking: '',
            final: finalMatch[1].trim(),
            hasThinking: false
        };
    }
    
    // If no AI format markers, return content as is
    return {
        thinking: '',
        final: content,
        hasThinking: false
    };
};

export default function MessageItem({ message, formatTime, copyToClipboard }: MessageItemProps) {
    const aiContent = message.role === "assistant" ? parseAIThinking(message.content) : null;
    const [isThinkingOpen, setIsThinkingOpen] = useState(false);

    return (
        <div
            className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
            {message.role === "assistant" && (
                <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <FaRobot size={16} className="text-primary-foreground" />
                    </div>
                </div>
            )}

            <div className={`flex flex-col max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                
                {/* AI Thinking Section (if exists) */}
                {message.role === "assistant" && aiContent?.hasThinking && (
                    <Collapsible open={isThinkingOpen} onOpenChange={setIsThinkingOpen}>
                        <CollapsibleTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="mb-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-2"
                            >
                                <FaBrain size={12} />
                                Thinking process
                                {isThinkingOpen ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="bg-muted/50 border border-border/50 rounded-lg p-3 mb-3 text-xs">
                                <div className="text-muted-foreground markdown-content">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeHighlight, rehypeRaw]}
                                    >
                                        {aiContent.thinking}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}

                {/* Main Message Content */}
                <div
                    className={`rounded-2xl px-4 py-3 ${message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted w-full"
                        }`}
                >
                    {/* Display images if present */}
                    {message.images && message.images.length > 0 && (
                        <div className="mb-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {message.images.map((image, index) => (
                                    <img
                                        key={index}
                                        src={image}
                                        alt={`Message image ${index + 1}`}
                                        className="w-full h-32 object-cover rounded-lg border border-border"
                                        onClick={() => window.open(image, '_blank')}
                                        style={{ cursor: 'pointer' }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

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
                                {aiContent?.final || message.content}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <div>
                            {message.content && (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {message.content}
                                </p>
                            )}
                        </div>
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
                                onClick={() => copyToClipboard(aiContent?.final || message.content)}
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
                <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                        <FaUser size={16} className="text-muted-foreground" />
                    </div>
                </div>
            )}
        </div>
    );
}
