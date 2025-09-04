import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { FaArrowRight, FaPaperclip, FaMicrophone, FaTimes } from "react-icons/fa";

interface InputBoxProps {
    onSendMessage?: (message: string, images?: string[]) => void;
    disabled?: boolean;
}

export default function InputBox({ onSendMessage, disabled = false }: InputBoxProps) {
    const [message, setMessage] = useState("");
    const [, setIsTyping] = useState(false);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSend = () => {
        if ((message.trim() || selectedImages.length > 0) && !disabled) {
            onSendMessage?.(message.trim(), selectedImages.length > 0 ? selectedImages : undefined);
            setMessage("");
            setSelectedImages([]);
            setIsTyping(false);
            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
        }
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const result = e.target?.result as string;
                    if (result) {
                        setSelectedImages(prev => [...prev, result]);
                    }
                };
                reader.readAsDataURL(file);
            }
        });
        
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeImage = (index: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
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
        <div className="w-full bg-background/95 backdrop-blur-sm border-t border-border/50 p-4">
            <div className="max-w-4xl mx-auto">
                {/* Image preview */}
                {selectedImages.length > 0 && (
                    <div className="mb-3">
                        <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-xl border border-border/30">
                            {selectedImages.map((image, index) => (
                                <div key={index} className="relative">
                                    <img
                                        src={image}
                                        alt={`Upload ${index + 1}`}
                                        className="w-16 h-16 object-cover rounded-lg border border-border"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeImage(index)}
                                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive hover:bg-destructive/90 p-0"
                                    >
                                        <FaTimes size={10} className="text-destructive-foreground" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex items-end gap-3 bg-muted/30 rounded-2xl p-3 border border-border/30 shadow-lg">
                    {/* Attachment button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled}
                        className="shrink-0 h-9 w-9 rounded-full hover:bg-muted-foreground/10 mb-1"
                    >
                        <FaPaperclip size={14} className="text-muted-foreground" />
                    </Button>

                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                    />

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
                        {(message.trim() || selectedImages.length > 0) && !disabled ? (
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