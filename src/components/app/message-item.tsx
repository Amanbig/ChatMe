import { useState } from "react";
import { FaRobot, FaCopy, FaThumbsUp, FaThumbsDown, FaChevronDown, FaChevronUp, FaBrain, FaVolumeUp, FaStop, FaCheck, FaClock } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import type { Message, ToolExecution } from "@/lib/types";
import { useTextToSpeech } from "../../hooks/use-text-to-speech";
import CustomMarkdownRenderer from "./custom-markdown-renderer";
import ToolExecutionDisplay from "./tool-execution-display";
import PermissionRequestMessage from "./permission-request-message";
import { toast } from "sonner";

interface MessageItemProps {
    message: Message;
    formatTime: (dateString: string) => string;
    copyToClipboard: (text: string) => void;
    autoSpeak?: boolean;
    toolExecutions?: ToolExecution[];
    onPermissionStatusUpdate?: (requestId: string, status: 'approved' | 'denied') => void;
}

// Parse AI thinking content
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

export default function MessageItem({ message, formatTime, copyToClipboard, autoSpeak = false, toolExecutions, onPermissionStatusUpdate }: MessageItemProps) {
    const aiContent = message.role === "assistant" ? parseAIThinking(message.content) : null;
    const [isThinkingOpen, setIsThinkingOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);

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
            const textToSpeak = message.role === "assistant"
                ? extractPlainText(aiContent?.final || message.content)
                : message.content;

            if (textToSpeak.trim()) {
                speak(textToSpeak);
            }
        }
    };

    const handleCopy = () => {
        copyToClipboard(aiContent?.final || message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleFeedback = (type: 'like' | 'dislike') => {
        setFeedback(type);
        toast.success(type === 'like' ? "Thanks for the feedback!" : "Feedback received");
    };

    const isUser = message.role === "user";
    const isPermissionRequest = !!message.permission_request;

    // Special standalone rendering for Permission Requests (compact & centered/inline)
    if (isPermissionRequest && message.permission_request) {
        return (
            <div className="py-1 my-1 flex justify-center w-full animate-in fade-in duration-200">
                <div className="max-w-xl w-full">
                    <PermissionRequestMessage
                        permissionRequest={message.permission_request}
                        onStatusUpdate={onPermissionStatusUpdate || (() => {})}
                    />
                </div>
            </div>
        );
    }

    // USER MESSAGE: Sleek, right-aligned, modern bubble
    if (isUser) {
        return (
            <TooltipProvider delayDuration={200}>
                <div className="flex flex-col items-end my-2 group">
                    <div className="max-w-[80%] sm:max-w-[70%]">
                        {/* Images */}
                        {message.images && message.images.length > 0 && (
                            <div className="mb-2">
                                <div className="grid grid-cols-2 gap-2">
                                    {message.images.map((image, index) => (
                                        <div
                                            key={index}
                                            className="relative overflow-hidden rounded-xl border border-border/40 shadow-sm"
                                        >
                                            <img
                                                src={image}
                                                alt={`Attachment ${index + 1}`}
                                                className="w-full h-32 object-cover cursor-pointer hover:scale-105 transition-transform"
                                                onClick={() => window.open(image, '_blank')}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Bubble */}
                        <div className="rounded-2xl rounded-br-xs px-4 py-2.5 bg-primary text-primary-foreground text-sm shadow-sm leading-relaxed whitespace-pre-wrap selection:bg-white/20">
                            {message.content}
                        </div>

                        {/* Actions on hover */}
                        <div className="flex items-center justify-end gap-2 px-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-muted-foreground select-none">
                            <span className="flex items-center gap-1">
                                <FaClock size={9} />
                                {formatTime(message.created_at)}
                            </span>
                            <button
                                onClick={handleCopy}
                                className="hover:text-foreground p-0.5 rounded transition-colors"
                                title="Copy"
                            >
                                {copied ? <FaCheck size={10} className="text-emerald-500" /> : <FaCopy size={10} />}
                            </button>
                        </div>
                    </div>
                </div>
            </TooltipProvider>
        );
    }

    // ASSISTANT MESSAGE: Modern structured card with avatar & tools
    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex gap-3 my-3 group animate-in fade-in duration-200">
                {/* Assistant Avatar */}
                <div className="shrink-0 mt-0.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 via-accent/20 to-primary/10 border border-primary/25 flex items-center justify-center shadow-xs">
                        <FaRobot size={15} className="text-primary" />
                    </div>
                </div>

                <div className="flex flex-col flex-1 min-w-0 max-w-full gap-1.5">
                    {/* Header */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground tracking-tight">
                            AI Assistant
                        </span>
                        {aiContent?.hasThinking && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1 text-muted-foreground border-border/50">
                                <FaBrain size={8} className="text-primary" />
                                Reasoning
                            </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatTime(message.created_at)}
                        </span>
                    </div>

                    {/* AI Thinking Collapsible */}
                    {aiContent?.hasThinking && (
                        <Collapsible open={isThinkingOpen} onOpenChange={setIsThinkingOpen}>
                            <CollapsibleTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg bg-muted/40 hover:bg-muted border border-border/40"
                                >
                                    <FaBrain size={10} className="text-primary" />
                                    <span>Thought Process</span>
                                    {isThinkingOpen ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />}
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="mt-1.5 bg-muted/30 border border-border/40 rounded-xl p-3 text-xs text-muted-foreground font-mono leading-relaxed max-h-60 overflow-y-auto">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeHighlight, rehypeRaw]}
                                    >
                                        {aiContent.thinking}
                                    </ReactMarkdown>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    )}

                    {/* Main Content Bubble */}
                    <div className="rounded-2xl rounded-tl-xs px-4 py-3 bg-card/70 backdrop-blur-xs border border-border/50 text-sm shadow-xs leading-relaxed overflow-hidden">
                        <div className="markdown-content">
                            <CustomMarkdownRenderer content={aiContent?.final || message.content} />
                        </div>

                        {/* Tool Executions */}
                        {toolExecutions && toolExecutions.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-border/40">
                                <ToolExecutionDisplay executions={toolExecutions} />
                            </div>
                        )}
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                                    onClick={handleCopy}
                                >
                                    {copied ? <FaCheck size={11} className="text-emerald-500" /> : <FaCopy size={11} />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p className="text-xs">{copied ? "Copied" : "Copy response"}</p>
                            </TooltipContent>
                        </Tooltip>

                        {supported && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`h-6 w-6 p-0 rounded-md transition-colors cursor-pointer ${speaking ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
                                        onClick={handleSpeak}
                                    >
                                        {speaking ? <FaStop size={11} /> : <FaVolumeUp size={11} />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    <p className="text-xs">{speaking ? "Stop" : "Read aloud"}</p>
                                </TooltipContent>
                            </Tooltip>
                        )}

                        <div className="w-px h-3 bg-border/60 mx-0.5" />

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-6 w-6 p-0 rounded-md transition-colors cursor-pointer ${feedback === 'like' ? 'text-emerald-500 bg-emerald-500/10' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={() => handleFeedback('like')}
                                >
                                    <FaThumbsUp size={10} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p className="text-xs">Helpful</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-6 w-6 p-0 rounded-md transition-colors cursor-pointer ${feedback === 'dislike' ? 'text-rose-500 bg-rose-500/10' : 'text-muted-foreground hover:text-foreground'}`}
                                    onClick={() => handleFeedback('dislike')}
                                >
                                    <FaThumbsDown size={10} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p className="text-xs">Not helpful</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
