import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { FaArrowRight, FaPaperclip, FaMicrophone } from "react-icons/fa";

interface InputBoxProps {
    onSendMessage?: (message: string) => void;
    disabled?: boolean;
}

export default function InputBox({ onSendMessage, disabled = false }: InputBoxProps) {
    const [message, setMessage] = useState("");
    const [, setIsTyping] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = () => {
        if (message.trim() && !disabled) {
            onSendMessage?.(message.trim());
            setMessage("");
            setIsTyping(false);
            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
        }
    };

    const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !disabled) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        setIsTyping(e.target.value.length > 0);
        
        // Auto-resize textarea
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    };

    return (
        <div className="w-full bg-background/95 backdrop-blur-sm border-t border-border/50 p-4 sticky bottom-0 z-10">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-end gap-3 bg-muted/30 rounded-2xl p-3 border border-border/30 shadow-lg">
                    {/* Attachment button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-9 w-9 rounded-full hover:bg-muted-foreground/10 mb-1"
                    >
                        <FaPaperclip size={14} className="text-muted-foreground" />
                    </Button>

                    {/* Text input area */}
                    <div className="flex-1 relative">
                        <Textarea
                            ref={textareaRef}
                            value={message}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyPress}
                            placeholder={disabled ? "AI is generating..." : "Type your message..."}
                            disabled={disabled}
                            className="min-h-[44px] max-h-[120px] resize-none border-none !bg-transparent dark:!bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none disabled:opacity-50 leading-relaxed"
                            rows={1}
                        />
                    </div>

                    {/* Voice/Send button */}
                    <div className="shrink-0 mb-1">
                        {message.trim() && !disabled ? (
                            <Button
                                onClick={handleSend}
                                size="sm"
                                className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 transition-all duration-200 shadow-md"
                            >
                                <FaArrowRight size={14} className="text-primary-foreground" />
                            </Button>
                        ) : disabled ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                className="h-9 w-9 rounded-full"
                            >
                                <div className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 rounded-full hover:bg-muted-foreground/10"
                            >
                                <FaMicrophone size={14} className="text-muted-foreground" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}