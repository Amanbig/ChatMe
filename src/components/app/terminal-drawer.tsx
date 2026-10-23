import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Play, Trash2, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface TerminalDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

interface CommandHistoryEntry {
    id: string;
    command: string;
    stdout: string;
    stderr: string;
    success: boolean;
    duration?: number;
    timestamp: string;
}

export default function TerminalDrawer({ isOpen, onClose }: TerminalDrawerProps) {
    const [command, setCommand] = useState('');
    const [workingDirectory, setWorkingDirectory] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [history, setHistory] = useState<CommandHistoryEntry[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [historyIndex, setHistoryIndex] = useState<number | null>(null);

    const outputEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            loadCwd();
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    useEffect(() => {
        outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, isExecuting]);

    const loadCwd = async () => {
        try {
            const cwd = await invoke<string>('get_current_directory');
            setWorkingDirectory(cwd);
        } catch {
            setWorkingDirectory('.');
        }
    };

    const handleRunCommand = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = command.trim();
        if (!trimmed || isExecuting) return;

        setIsExecuting(true);
        const startTime = Date.now();
        const entryId = `${Date.now()}`;

        // Clear input immediately
        setCommand('');
        setHistoryIndex(null);

        try {
            const result = await invoke<any>('execute_command', {
                command: trimmed,
                workingDirectory: workingDirectory || null,
                requestPermission: false
            });

            const newEntry: CommandHistoryEntry = {
                id: entryId,
                command: trimmed,
                stdout: result.stdout || '',
                stderr: result.stderr || '',
                success: result.success !== false,
                duration: result.execution_time_ms || (Date.now() - startTime),
                timestamp: new Date().toLocaleTimeString()
            };

            setHistory(prev => [...prev, newEntry]);

            // If command was cd, update cwd
            if (trimmed.startsWith('cd ')) {
                loadCwd();
            }
        } catch (error: any) {
            setHistory(prev => [
                ...prev,
                {
                    id: entryId,
                    command: trimmed,
                    stdout: '',
                    stderr: String(error?.message || error || 'Command execution error'),
                    success: false,
                    duration: Date.now() - startTime,
                    timestamp: new Date().toLocaleTimeString()
                }
            ]);
            toast.error(`Execution failed: ${error?.message || error}`);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (history.length === 0) return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
            setHistoryIndex(nextIndex);
            setCommand(history[nextIndex].command);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex !== null) {
                const nextIndex = historyIndex + 1;
                if (nextIndex < history.length) {
                    setHistoryIndex(nextIndex);
                    setCommand(history[nextIndex].command);
                } else {
                    setHistoryIndex(null);
                    setCommand('');
                }
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className={`fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-md text-zinc-100 border-t border-zinc-800 shadow-2xl flex flex-col transition-all duration-200 ${
                isExpanded ? 'h-[500px]' : 'h-[260px]'
            }`}
        >
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/80 text-xs">
                <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-emerald-400" />
                    <span className="font-semibold text-zinc-200 font-mono">Agent Developer Terminal</span>
                    {workingDirectory && (
                        <span className="text-zinc-500 font-mono text-[11px] truncate max-w-sm hidden sm:inline" title={workingDirectory}>
                            ({workingDirectory})
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {history.length > 0 && (
                        <button
                            onClick={() => setHistory([])}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                            title="Clear Terminal Output"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        title={isExpanded ? 'Minimize height' : 'Expand height'}
                    >
                        {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors ml-1"
                        title="Close Terminal"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Terminal Logs View */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-3">
                {history.length === 0 && (
                    <div className="text-zinc-500 italic py-4 text-center select-none text-[11px]">
                        Agent developer terminal ready. Type shell commands (e.g. <code className="text-zinc-400 font-semibold">git status</code>, <code className="text-zinc-400 font-semibold">npm test</code>, <code className="text-zinc-400 font-semibold">ls</code>) to execute directly in your workspace.
                    </div>
                )}

                {history.map((entry) => (
                    <div key={entry.id} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                            <div className="flex items-center gap-1.5 font-medium text-emerald-400">
                                <span>$</span>
                                <span className="text-zinc-100">{entry.command}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                {entry.duration !== undefined && <span>{entry.duration}ms</span>}
                                <span>{entry.timestamp}</span>
                            </div>
                        </div>

                        {entry.stdout && (
                            <pre className="text-zinc-300 text-xs whitespace-pre-wrap break-words bg-black/40 p-2.5 rounded border border-zinc-900 overflow-x-auto max-h-48">
                                {entry.stdout}
                            </pre>
                        )}

                        {entry.stderr && (
                            <pre className="text-rose-400 text-xs whitespace-pre-wrap break-words bg-rose-950/20 p-2.5 rounded border border-rose-900/40 overflow-x-auto max-h-48">
                                {entry.stderr}
                            </pre>
                        )}
                    </div>
                ))}

                {isExecuting && (
                    <div className="flex items-center gap-2 text-zinc-400 py-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                        <span className="text-[11px]">Running command...</span>
                    </div>
                )}

                <div ref={outputEndRef} />
            </div>

            {/* Terminal Input Bar */}
            <form onSubmit={handleRunCommand} className="flex items-center gap-2 p-2.5 border-t border-zinc-800 bg-zinc-900/90">
                <span className="text-emerald-400 font-mono font-bold pl-2 select-none text-xs">$</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isExecuting}
                    placeholder="Enter command (e.g. ls, git status, npm list)..."
                    className="flex-1 bg-transparent border-0 outline-none font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:ring-0"
                />
                <button
                    type="submit"
                    disabled={!command.trim() || isExecuting}
                    className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                >
                    {isExecuting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
                    <span>Exec</span>
                </button>
            </form>
        </div>
    );
}
