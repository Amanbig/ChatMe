import { useState } from "react";
import { FaRobot, FaChevronDown, FaChevronUp, FaBrain, FaVolumeUp, FaStop } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import type { StreamingMessage, ToolExecution } from "@/lib/types";
import { useTextToSpeech } from "../../hooks/use-text-to-speech";
import ToolExecutionDisplay from "./tool-execution-display";

interface StreamingMessageItemProps {
    streamingMessage: StreamingMessage;
    autoSpeak?: boolean;
    toolExecutions?: ToolExecution[];
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

function TypingIndicator() {
    return (
        <div className="flex items-center gap-1.5 px-1 py-1.5">
            <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
            <span className="text-[11px] text-muted-foreground ml-1">Streaming response...</span>
        </div>
    );
}

export default function StreamingMessageItem({
    streamingMessage,
    autoSpeak = false,
    toolExecutions = []
}: StreamingMessageItemProps) {
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
        <div className="flex gap-3 my-3 group animate-in fade-in duration-200">
            {/* AI Avatar */}
            <div className="shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/25 via-accent/20 to-primary/10 border border-primary/30 flex items-center justify-center shadow-xs">
                    <FaRobot size={15} className="text-primary animate-pulse" />
                </div>
            </div>

            <div className="flex flex-col flex-1 min-w-0 max-w-full gap-1.5">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">AI Assistant</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1 text-primary border-primary/30 bg-primary/5 animate-pulse">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                        Generating
                    </Badge>
                    {streamingAIContent.hasThinking && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1 text-muted-foreground border-border/50">
                            <FaBrain size={8} className="text-primary" />
                            Reasoning
                        </Badge>
                    )}
                </div>

                {/* AI Thinking Collapsible */}
                {streamingAIContent.hasThinking && (
                    <Collapsible open={isStreamingThinkingOpen} onOpenChange={setIsStreamingThinkingOpen}>
                        <CollapsibleTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg bg-muted/40 hover:bg-muted border border-border/40"
                            >
                                <FaBrain size={10} className="text-primary" />
                                <span>Thinking process</span>
                                {isStreamingThinkingOpen ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="mt-1.5 bg-muted/30 border border-border/40 rounded-xl p-3 text-xs text-muted-foreground font-mono leading-relaxed max-h-60 overflow-y-auto">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeHighlight, rehypeRaw]}
                                >
                                    {streamingAIContent.thinking}
                                </ReactMarkdown>
                                {isThinking && (
                                    <div className="mt-2 pt-2 border-t border-border/30">
                                        <TypingIndicator />
                                    </div>
                                )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}

                {/* Content Bubble */}
                <div className="relative rounded-2xl rounded-tl-xs bg-card/70 backdrop-blur-xs border border-border/50 px-4 py-3 shadow-xs">
                    {/* Top Shimmer */}
                    <div className="absolute top-0 left-4 right-4 h-0.5 bg-primary/20 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse w-full" />
                    </div>

                    <div className="text-sm markdown-content leading-relaxed">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight, rehypeRaw]}
                        >
                            {streamingAIContent.final}
                        </ReactMarkdown>
                    </div>

                    {isThinking && !streamingAIContent.hasThinking && (
                        <TypingIndicator />
                    )}

                    {/* Live Tool Executions */}
                    {toolExecutions && toolExecutions.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-border/40">
                            <ToolExecutionDisplay executions={toolExecutions} />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-1 px-1">
                    <span className="text-[10px] text-muted-foreground">Generating response...</span>
                    {supported && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`h-5 w-5 p-0 rounded-md ml-1 ${speaking ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={handleSpeak}
                        >
                            {speaking ? <FaStop size={9} /> : <FaVolumeUp size={9} />}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
