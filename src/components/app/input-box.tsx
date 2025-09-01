import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { FaArrowRight, FaPaperclip, FaMicrophone } from "react-icons/fa";

export default function InputBox() {
    const [message, setMessage] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = () => {
        if (message.trim()) {
            console.log("Sending message:", message);
            setMessage("");
            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
        }
    };

    const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
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
        <div className="sticky bottom-0 w-full bg-background/80 backdrop-blur-sm border-t p-4">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-2 bg-muted/50 rounded-2xl p-3 border border-border/50 shadow-sm">
                    {/* Attachment button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-8 w-8 rounded-full hover:bg-muted"
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
                            placeholder="Type your message..."
                            className="min-h-[40px] max-h-[120px] resize-none border-none !bg-transparent dark:!bg-transparent p-2 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                            rows={1}
                        />
                    </div>

                    {/* Voice/Send button */}
                    <div className="shrink-0">
                        {message.trim() ? (
                            <Button
                                onClick={handleSend}
                                size="sm"
                                className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 transition-all duration-200"
                            >
                                <FaArrowRight size={14} className="text-primary-foreground" />
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 rounded-full hover:bg-muted"
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