import { useState } from "react";
import { FaRobot, FaChevronDown, FaChevronUp, FaBrain } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import type { StreamingMessage } from "@/lib/types";

interface StreamingMessageItemProps {
    streamingMessage: StreamingMessage;
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

export default function StreamingMessageItem({ streamingMessage }: StreamingMessageItemProps) {
    const streamingAIContent = parseAIThinking(streamingMessage.content);
    const [isStreamingThinkingOpen, setIsStreamingThinkingOpen] = useState(false);

    return (
        <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 mt-1">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <FaRobot size={16} className="text-primary-foreground" />
                </div>
            </div>

            <div className="flex flex-col max-w-[80%] items-start">
                {/* Streaming AI Thinking Section */}
                {streamingAIContent.hasThinking && (
                    <Collapsible open={isStreamingThinkingOpen} onOpenChange={setIsStreamingThinkingOpen}>
                        <CollapsibleTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="mb-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-2"
                            >
                                <FaBrain size={12} />
                                Thinking process
                                {isStreamingThinkingOpen ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="bg-muted/50 border border-border/50 rounded-lg p-3 mb-3 text-xs">
                                <div className="text-muted-foreground markdown-content">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeHighlight, rehypeRaw]}
                                    >
                                        {streamingAIContent.thinking}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}

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
                            {streamingAIContent.final}
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
    );
}
