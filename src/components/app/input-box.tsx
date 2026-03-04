import { useState, useRef, KeyboardEvent, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { FaArrowRight, FaPaperclip, FaMicrophone, FaTimes, FaStop, FaKeyboard, FaMagic } from "react-icons/fa";
import { useSpeechRecognition } from "../../hooks/use-speech-recognition";
import { toast } from "sonner";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "../ui/tooltip";
import { Badge } from "../ui/badge";

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
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [lastCommand, setLastCommand] = useState<string>("");

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

    useImperativeHandle(ref, () => ({
        focus: () => {
            textareaRef.current?.focus();
        },
        insertText: (text: string) => {
            setMessage(prev => prev + text);
        }
    }));

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
        }
    }, [message]);

    useEffect(() => {
        const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                textareaRef.current?.focus();
            }
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
            resetTranscript();
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

        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
        }
    };

    const hasContent = message.trim().length > 0 || selectedImages.length > 0;
    const charCount = message.length;
    const maxChars = 4000;

    return (
        <TooltipProvider delayDuration={300}>
            <div className="w-full glass-strong border-t border-border/40 p-3 sm:p-4">
                <div className="max-w-4xl mx-auto">
                    {/* Image preview */}
                    {selectedImages.length > 0 && (
                        <div className="mb-3 animate-in slide-in-from-bottom-2 duration-200">
                            <div className="flex flex-wrap gap-2 p-3 bg-muted/40 rounded-xl border border-border/30">
                                {selectedImages.map((image, index) => (
                                    <div key={index} className="relative group animate-in zoom-in-95 duration-200">
                                        <img
                                            src={image}
                                            alt={`Upload ${index + 1}`}
                                            className="w-16 h-16 object-cover rounded-lg border border-border/50 shadow-sm"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeImage(index)}
                                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive hover:bg-destructive/90 p-0 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <FaTimes size={10} className="text-destructive-foreground" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Main input container */}
                    <div
                        className={`relative flex items-end gap-2 bg-card rounded-2xl border-2 p-2 shadow-lg transition-all duration-300 ${isFocused
                            ? 'border-primary/50 shadow-primary/10 ring-4 ring-primary/5'
                            : 'border-border/40 hover:border-border/60'
                            } ${disabled ? 'opacity-60' : ''}`}
                    >
                        {/* Attachment button */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={disabled}
                                    className="shrink-0 h-10 w-10 rounded-xl hover:bg-muted-foreground/10 transition-colors"
                                >
                                    <FaPaperclip size={16} className="text-muted-foreground" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p className="text-xs">Attach images</p>
                            </TooltipContent>
                        </Tooltip>

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
                        <div className="flex-1 relative min-w-0">
                            <Textarea
                                ref={textareaRef}
                                value={message}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyPress}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                placeholder={
                                    disabled
                                        ? "AI is generating a response..."
                                        : isListening
                                            ? "Listening... Speak now or click stop"
                                            : "Type your message here..."
                                }
                                disabled={disabled}
                                className="min-h-[44px] max-h-[160px] resize-none border-0 bg-transparent px-2 py-2.5 text-sm placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none disabled:opacity-50 leading-relaxed"
                                rows={1}
                            />

                            {/* Speech transcript overlay */}
                            {isListening && transcript && (
                                <div className="absolute bottom-full left-0 right-0 mb-2 p-2.5 bg-primary/10 text-primary text-xs rounded-lg border border-primary/20 animate-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                        <span className="font-medium">{transcript}</span>
                                    </div>
                                </div>
                            )}

                            {/* Character count */}
                            {charCount > 0 && (
                                <div className={`absolute right-2 bottom-1 text-[10px] transition-colors ${charCount > maxChars * 0.9 ? 'text-destructive' : 'text-muted-foreground/50'
                                    }`}>
                                    {charCount}/{maxChars}
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="shrink-0 flex items-center gap-1">
                            {hasContent && !disabled ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            onClick={handleSend}
                                            size="sm"
                                            className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-primary/25 hover:scale-105"
                                        >
                                            <FaArrowRight size={16} className="text-primary-foreground" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p className="text-xs">Send message (Enter)</p>
                                    </TooltipContent>
                                </Tooltip>
                            ) : disabled ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled
                                    className="h-10 w-10 rounded-xl"
                                >
                                    <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
                                </Button>
                            ) : (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleMicrophoneClick}
                                            disabled={disabled}
                                            className={`h-10 w-10 rounded-xl transition-all duration-200 ${isListening
                                                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 animate-pulse'
                                                : 'hover:bg-muted-foreground/10'
                                                }`}
                                        >
                                            {isListening ? (
                                                <FaStop size={16} className="text-white" />
                                            ) : (
                                                <FaMicrophone size={16} className="text-muted-foreground" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p className="text-xs">{isListening ? "Stop listening" : "Voice input"}</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </div>

                    {/* Keyboard shortcuts hint */}
                    <div className="mt-2 flex items-center justify-center gap-4">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground flex items-center gap-1.5 transition-colors">
                                    <FaKeyboard className="h-3 w-3" />
                                    <span>Shortcuts</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs p-3">
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between gap-4">
                                        <span className="opacity-70">Focus input:</span>
                                        <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono">Ctrl+K</kbd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="opacity-70">Repeat last:</span>
                                        <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono">Ctrl+R</kbd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="opacity-70">Send message:</span>
                                        <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono">Enter</kbd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="opacity-70">New line:</span>
                                        <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono">Shift+Enter</kbd>
                                    </div>
                                </div>
                            </TooltipContent>
                        </Tooltip>

                        {disabled && (
                            <Badge variant="secondary" className="text-[10px] gap-1 animate-pulse">
                                <FaMagic size={10} className="text-primary" />
                                AI is thinking...
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
});

InputBox.displayName = 'InputBox';

export default InputBox;
