import { useState } from "react";
import { FaRobot, FaChevronDown, FaChevronUp, FaBrain, FaVolumeUp, FaStop } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import type { StreamingMessage } from "@/lib/types";
import { useTextToSpeech } from "../../hooks/use-text-to-speech";

interface StreamingMessageItemProps {
    streamingMessage: StreamingMessage;
    autoSpeak?: boolean;
}

const parseAIThinking = (content: string) => {
    const thinkingRegex = /<\|start\|>assistant<\|channel\|>thinking<\|message\|>([\s\S]*?)<\|start\|>assistant<\|channel\|>final<\|message\|>([\s\S]*?)$/;
    const thinkingMatch = content.match(thinkingRegex);

    if (thinkingMatch) {
        return {
            thinking: thinkingMatch[1].trim(),
            final: thinkingMatch[2].trim(),
            hasThinking: true
        };
    }

    const finalOnlyRegex = /<\|start\|>assistant<\|channel\|>final<\|message\|>([\s\S]*)$/;
    const finalMatch = content.match(finalOnlyRegex);

    if (finalMatch) {
        return {
            thinking: '',
            final: finalMatch[1].trim(),
            hasThinking: false
        };
    }

    return {
        thinking: '',
        final: content,
        hasThinking: false
    };
};

// Typing indicator component
function TypingIndicator() {
    return (
        <div className="flex items-center gap-1.5 px-1 py-2">
            <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-primary/60 rounded-full typing-dot" />
                <span className="w-2 h-2 bg-primary/60 rounded-full typing-dot" style={{ animationDelay: '0.2s' }} />
                <span className="w-2 h-2 bg-primary/60 rounded-full typing-dot" style={{ animationDelay: '0.4s' }} />
            </div>
            <span className="text-xs text-muted-foreground ml-1">AI is thinking...</span>
        </div>
    );
}

export default function StreamingMessageItem({ streamingMessage, autoSpeak = false }: StreamingMessageItemProps) {
    const streamingAIContent = parseAIThinking(streamingMessage.content);
    const [isStreamingThinkingOpen, setIsStreamingThinkingOpen] = useState(true);

    const { speak, cancel, speaking, supported } = useTextToSpeech();

    void autoSpeak;

    const extractPlainText = (markdownContent: string): string => {
        return markdownContent
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`[^`]+`/g, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/#{1,6}\s+/g, '')
            .replace(/^\s*[-*+]\s+/gm, '')
            .replace(/\n{2,}/g, '. ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const handleSpeak = () => {
        if (!supported) return;

        if (speaking) {
            cancel();
        } else {
            const textToSpeak = extractPlainText(streamingAIContent?.final || streamingMessage.content);

            if (textToSpeak.trim()) {
                speak(textToSpeak);
            }
        }
    };

    const isThinking = streamingMessage.content.includes('<|channel|>thinking<|message|>') &&
        !streamingMessage.content.includes('<|channel|>final<|message|>');

    return (
        <div className="flex gap-4 justify-start message-animate group">
            {/* AI Avatar with pulse animation */}
            <div className="flex-shrink-0 mt-1">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                    <FaRobot size={16} className="text-primary-foreground" />
                </div>
            </div>

            <div className="flex flex-col max-w-[85%] items-start gap-1.5">
                {/* Sender Label */}
                <div className="flex items-center gap-2 px-1">
                    <span className="text-xs font-medium text-primary">AI Assistant</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                        Generating
                    </Badge>
                    {streamingAIContent.hasThinking && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1">
                            <FaBrain size={8} />
                            Reasoning
                        </Badge>
                    )}
                </div>

                {/* Streaming AI Thinking Section */}
                {streamingAIContent.hasThinking && (
                    <Collapsible open={isStreamingThinkingOpen} onOpenChange={setIsStreamingThinkingOpen}>
                        <CollapsibleTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg bg-muted/50 hover:bg-muted"
                            >
                                <FaBrain size={11} className="text-accent" />
                                <span>Thinking process</span>
                                {isStreamingThinkingOpen ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="mt-2 bg-muted/40 border border-border/50 rounded-xl p-3 text-xs">
                                <div className="text-muted-foreground markdown-content">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeHighlight, rehypeRaw]}
                                    >
                                        {streamingAIContent.thinking}
                                    </ReactMarkdown>
                                </div>
                                {isThinking && (
                                    <div className="mt-2 pt-2 border-t border-border/30">
                                        <TypingIndicator />
                                    </div>
                                )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}

                {/* Main Streaming Message Content */}
                <div className="relative rounded-2xl rounded-bl-md bg-card border border-border/60 w-full px-5 py-3.5 shadow-sm hover:border-border/80 transition-all">
                    {/* Progress bar at top */}
                    <div className="absolute top-0 left-4 right-4 h-0.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary/50 via-primary to-accent/50 animate-[shimmer_1.5s_infinite]"
                            style={{
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 1.5s ease-in-out infinite'
                            }}
                        />
                    </div>

                    <div className="text-sm markdown-content leading-relaxed">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight, rehypeRaw]}
                        >
                            {streamingAIContent.final}
                        </ReactMarkdown>
                    </div>

                    {/* Typing indicator when no final content yet */}
                    {isThinking && !streamingAIContent.hasThinking && (
                        <TypingIndicator />
                    )}
                </div>

                {/* Message Actions */}
                <div className="flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="text-[11px] text-muted-foreground">Generating response...</span>

                    {supported && (
                        <>
                            <div className="w-px h-3 bg-border mx-1" />
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 w-6 p-0 rounded-md ${speaking ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
                                onClick={handleSpeak}
                            >
                                {speaking ? <FaStop size={11} /> : <FaVolumeUp size={11} />}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
