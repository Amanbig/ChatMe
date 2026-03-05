import { useState } from "react";
import { FaUser, FaRobot, FaCopy, FaThumbsUp, FaThumbsDown, FaChevronDown, FaChevronUp, FaBrain, FaVolumeUp, FaStop, FaCheck, FaClock, FaShieldAlt } from "react-icons/fa";
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
        toast.success(type === 'like' ? "Thanks for the feedback!" : "Thanks, we'll improve!");
    };

    const isUser = message.role === "user";
    const isSystem = message.role === "system";
    const isPermissionRequest = !!message.permission_request;

    return (
        <TooltipProvider delayDuration={200}>
            <div className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"} message-animate group`}>
                {/* AI/System Avatar */}
                {!isUser && (
                    <div className="flex-shrink-0 mt-1">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg ${
                            isSystem
                                ? "bg-gradient-to-br from-yellow-500 to-orange-500 shadow-yellow-500/20"
                                : "bg-gradient-to-br from-primary to-accent shadow-primary/20"
                        }`}>
                            {isSystem ? (
                                <FaShieldAlt size={16} className="text-white" />
                            ) : (
                                <FaRobot size={16} className="text-primary-foreground" />
                            )}
                        </div>
                    </div>
                )}

                <div className={`flex flex-col max-w-[85%] ${isUser ? "items-end" : "items-start"} gap-1.5`}>
                    {/* Sender Label */}
                    <div className="flex items-center gap-2 px-1">
                        <span className={`text-xs font-medium ${
                            isUser ? "text-muted-foreground" : isSystem ? "text-yellow-600 dark:text-yellow-500" : "text-primary"
                        }`}>
                            {isUser ? "You" : isSystem ? "System" : "AI Assistant"}
                        </span>
                        {aiContent?.hasThinking && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-1">
                                <FaBrain size={8} />
                                Reasoning
                            </Badge>
                        )}
                    </div>

                    {/* AI Thinking Section */}
                    {!isUser && aiContent?.hasThinking && (
                        <Collapsible open={isThinkingOpen} onOpenChange={setIsThinkingOpen}>
                            <CollapsibleTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg bg-muted/50 hover:bg-muted"
                                >
                                    <FaBrain size={11} className="text-accent" />
                                    <span>Thinking process</span>
                                    {isThinkingOpen ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="mt-2 bg-muted/40 border border-border/50 rounded-xl p-3 text-xs">
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
                        className={`relative rounded-2xl px-5 py-3.5 shadow-sm transition-all duration-200 ${isUser
                                ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md shadow-primary/20"
                                : "bg-card border border-border/60 w-full hover:border-border/80 rounded-bl-md"
                            }`}
                    >
                        {/* Decorative corner accent for user messages */}
                        {isUser && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary/20 rounded-full blur-md" />
                        )}

                        {/* Images */}
                        {message.images && message.images.length > 0 && (
                            <div className="mb-3">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {message.images.map((image, index) => (
                                        <div
                                            key={index}
                                            className="relative group/image overflow-hidden rounded-lg"
                                        >
                                            <img
                                                src={image}
                                                alt={`Message image ${index + 1}`}
                                                className="w-full h-32 object-cover cursor-pointer transition-transform duration-300 group-hover/image:scale-105"
                                                onClick={() => window.open(image, '_blank')}
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Permission Request */}
                        {isPermissionRequest && message.permission_request && (
                            <PermissionRequestMessage
                                permissionRequest={message.permission_request}
                                onStatusUpdate={onPermissionStatusUpdate || (() => {})}
                            />
                        )}

                        {/* Message Text - only show if not a permission request or has additional content */}
                        {!isPermissionRequest && (
                            <>
                                {!isUser ? (
                                    <div className="text-sm markdown-content leading-relaxed">
                                        <CustomMarkdownRenderer content={aiContent?.final || message.content} />
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
                            </>
                        )}

                        {/* Tool Executions */}
                        {!isUser && !isPermissionRequest && toolExecutions && toolExecutions.length > 0 && (
                            <ToolExecutionDisplay executions={toolExecutions} />
                        )}
                    </div>

                    {/* Message Actions */}
                    <div className="flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {/* Timestamp */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1 cursor-default">
                                    <FaClock size={9} />
                                    {formatTime(message.created_at)}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p className="text-xs">{new Date(message.created_at).toLocaleString()}</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* AI-specific actions */}
                        {!isUser && (
                            <>
                                <div className="w-px h-3 bg-border mx-1" />

                                {supported && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={`h-6 w-6 p-0 rounded-md transition-colors ${speaking ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
                                                onClick={handleSpeak}
                                            >
                                                {speaking ? <FaStop size={11} /> : <FaVolumeUp size={11} />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">
                                            <p className="text-xs">{speaking ? "Stop speaking" : "Read aloud"}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:text-foreground"
                                            onClick={handleCopy}
                                        >
                                            {copied ? <FaCheck size={11} className="text-green-500" /> : <FaCopy size={11} />}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p className="text-xs">{copied ? "Copied!" : "Copy message"}</p>
                                    </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={`h-6 w-6 p-0 rounded-md transition-colors ${feedback === 'like' ? 'text-green-500' : 'text-muted-foreground hover:text-foreground'}`}
                                            onClick={() => handleFeedback('like')}
                                        >
                                            <FaThumbsUp size={11} />
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
                                            className={`h-6 w-6 p-0 rounded-md transition-colors ${feedback === 'dislike' ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}
                                            onClick={() => handleFeedback('dislike')}
                                        >
                                            <FaThumbsDown size={11} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p className="text-xs">Not helpful</p>
                                    </TooltipContent>
                                </Tooltip>
                            </>
                        )}
                    </div>
                </div>

                {/* User Avatar */}
                {isUser && (
                    <div className="flex-shrink-0 mt-1">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-muted to-muted/70 border border-border/50 flex items-center justify-center">
                            <FaUser size={14} className="text-muted-foreground" />
                        </div>
                    </div>
                )}
            </div>
        </TooltipProvider>
    );
}
