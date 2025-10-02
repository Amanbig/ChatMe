import { useState, useRef, KeyboardEvent, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { FaArrowRight, FaPaperclip, FaMicrophone, FaTimes, FaStop, FaKeyboard } from "react-icons/fa";
import { useSpeechRecognition } from "../../hooks/use-speech-recognition";
import { toast } from "sonner";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "../ui/tooltip";

interface InputBoxProps {
    onSendMessage?: (message: string, images?: string[]) => void;
    disabled?: boolean;
}

export interface InputBoxRef {
    focus: () => void;
    insertText: (text: string) => void;
}

const InputBox = forwardRef<InputBoxRef, InputBoxProps>(({ onSendMessage, disabled = false }, ref) => {
    const [message, setMessage] = useState("");
    const [, setIsTyping] = useState(false);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [lastCommand, setLastCommand] = useState<string>("");

    // Speech recognition setup
    const {
        isListening,
        transcript,
        startListening,
        stopListening,
        resetTranscript,
        browserSupportsSpeechRecognition
    } = useSpeechRecognition({
        onResult: (finalTranscript) => {
            setMessage(prev => prev + finalTranscript);
            setIsTyping(true);
        },
        onError: (error) => {
            toast.error(`Speech recognition error: ${error}`);
        },
        continuous: true,
        interimResults: true
    });

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
        focus: () => {
            textareaRef.current?.focus();
        },
        insertText: (text: string) => {
            setMessage(prev => prev + text);
        }
    }));

    // Auto-resize textarea when message changes
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [message]);

    // Global keyboard shortcuts
    useEffect(() => {
        const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
            // Ctrl+K or Cmd+K to focus input
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                textareaRef.current?.focus();
            }
            // Ctrl+R or Cmd+R to repeat last command (only when focused)
            if ((e.ctrlKey || e.metaKey) && e.key === 'r' && document.activeElement === textareaRef.current) {
                e.preventDefault();
                if (lastCommand) {
                    setMessage(lastCommand);
                    toast.info("Repeated last command");
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [lastCommand]);

    const handleSend = () => {
        if ((message.trim() || selectedImages.length > 0) && !disabled) {
            const trimmedMessage = message.trim();
            if (trimmedMessage) {
                setLastCommand(trimmedMessage);
            }
            onSendMessage?.(trimmedMessage, selectedImages.length > 0 ? selectedImages : undefined);
            setMessage("");
            setSelectedImages([]);
            setIsTyping(false);
            resetTranscript(); // Clear speech recognition transcript
            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
        }
    };

    const handleMicrophoneClick = () => {
        if (!browserSupportsSpeechRecognition) {
            toast.error("Speech recognition is not supported in your browser");
            return;
        }

        if (isListening) {
            stopListening();
        } else {
            startListening();
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
                        aria-label="Upload images"
                    />

                    {/* Text input area */}
                    <div className="flex-1 relative">
                        <Textarea
                            ref={textareaRef}
                            value={message}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyPress}
                            placeholder={
                                disabled 
                                    ? "AI is generating..." 
                                    : isListening 
                                        ? "Listening... Speak now or click microphone to stop"
                                        : "Type your message... (Ctrl+K to focus)"
                            }
                            disabled={disabled}
                            className="min-h-[44px] max-h-[120px] resize-none border-none !bg-transparent dark:!bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none disabled:opacity-50 leading-relaxed"
                            rows={1}
                        />
                        {/* Show interim speech results */}
                        {isListening && transcript && (
                            <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-primary/10 text-primary text-xs rounded-lg border border-primary/20">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                    <span>Listening: {transcript}</span>
                                </div>
                            </div>
                        )}
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
                                onClick={handleMicrophoneClick}
                                disabled={disabled}
                                className={`h-9 w-9 rounded-full transition-all duration-200 ${
                                    isListening 
                                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                                        : 'hover:bg-muted-foreground/10'
                                }`}
                            >
                                {isListening ? (
                                    <FaStop size={14} className="text-white" />
                                ) : (
                                    <FaMicrophone size={14} className="text-muted-foreground" />
                                )}
                            </Button>
                        )}
                    </div>
                </div>
                
                {/* Keyboard shortcuts hint */}
                <div className="mt-2 flex justify-center">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                                    <FaKeyboard className="h-3 w-3" />
                                    Keyboard Shortcuts
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <div className="space-y-2">
                                    <div className="flex justify-between gap-4">
                                        <span className="opacity-70">Focus input:</span>
                                        <kbd className="px-1.5 py-0.5 bg-background/80 border border-border rounded text-xs font-mono">Ctrl+K</kbd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="opacity-70">Repeat last:</span>
                                        <kbd className="px-1.5 py-0.5 bg-background/80 border border-border rounded text-xs font-mono">Ctrl+R</kbd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="opacity-70">Send message:</span>
                                        <kbd className="px-1.5 py-0.5 bg-background/80 border border-border rounded text-xs font-mono">Enter</kbd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="opacity-70">New line:</span>
                                        <kbd className="px-1.5 py-0.5 bg-background/80 border border-border rounded text-xs font-mono">Shift+Enter</kbd>
                                    </div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </div>
    );
});

InputBox.displayName = 'InputBox';

export default InputBox;
