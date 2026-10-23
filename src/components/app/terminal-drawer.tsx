import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Trash2, Maximize2, Minimize2, Copy, Check, CornerDownLeft, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { changeDirectory } from '@/lib/api';
import { toast } from 'sonner';

interface TerminalDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

interface TerminalLine {
    id: string;
    type: 'prompt' | 'stdout' | 'stderr' | 'system' | 'info';
    text: string;
    cwd?: string;
    exitCode?: number;
    duration?: number;
}

export default function TerminalDrawer({ isOpen, onClose }: TerminalDrawerProps) {
    const [command, setCommand] = useState('');
    const [workingDirectory, setWorkingDirectory] = useState('');
    const [lines, setLines] = useState<TerminalLine[]>([]);
    const [commandHistory, setCommandHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [activeRunningCmd, setActiveRunningCmd] = useState('');
    const [heightMode, setHeightMode] = useState<'normal' | 'expanded' | 'full'>('normal');
    const [copied, setCopied] = useState(false);
    const [username, setUsername] = useState('user');

    const terminalContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initial setup on open
    useEffect(() => {
        if (isOpen) {
            loadCwd();
            invoke<{ os?: string; arch?: string }>('get_system_info')
                .then((info) => {
                    const localUser = info?.os === 'linux' ? 'developer' : 'user';
                    setUsername(localUser);
                })
                .catch(() => {});

            if (lines.length === 0) {
                setLines([
                    {
                        id: 'init-1',
                        type: 'system',
                        text: 'ChatMe System Terminal (native shell environment)'
                    },
                    {
                        id: 'init-2',
                        type: 'info',
                        text: 'Ready. Type shell commands or "help" for shortcuts. Use "clear" or Ctrl+L to clear screen.'
                    }
                ]);
            }

            setTimeout(() => inputRef.current?.focus(), 80);
        }
    }, [isOpen]);

    // Keep scrolled to bottom
    useEffect(() => {
        if (terminalContainerRef.current) {
            terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
        }
    }, [lines, isExecuting, command]);

    const loadCwd = async () => {
        try {
            const cwd = await invoke<string>('get_current_directory');
            setWorkingDirectory(cwd);
        } catch {
            setWorkingDirectory('.');
        }
    };

    const getShortCwd = (fullPath: string): string => {
        if (!fullPath) return '~';
        const homePrefix = '/home/';
        if (fullPath.startsWith(homePrefix)) {
            const parts = fullPath.split('/');
            if (parts.length >= 3) {
                const userHome = parts.slice(0, 3).join('/');
                if (fullPath.startsWith(userHome)) {
                    return '~' + fullPath.slice(userHome.length);
                }
            }
        }
        return fullPath;
    };

    const handleRunCommand = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const rawCmd = command;
        const trimmed = rawCmd.trim();
        if (!trimmed || isExecuting) return;

        // Reset input immediately
        setCommand('');
        setHistoryIndex(null);
        setCommandHistory(prev => [...prev, trimmed]);

        const promptLine: TerminalLine = {
            id: `prompt-${Date.now()}`,
            type: 'prompt',
            text: trimmed,
            cwd: getShortCwd(workingDirectory)
        };

        // 1. Built-in: clear / cls
        if (trimmed === 'clear' || trimmed === 'cls') {
            setLines([]);
            return;
        }

        // 2. Built-in: exit
        if (trimmed === 'exit' || trimmed === 'quit') {
            onClose();
            return;
        }

        // 3. Built-in: help
        if (trimmed === 'help') {
            setLines(prev => [
                ...prev,
                promptLine,
                {
                    id: `help-${Date.now()}`,
                    type: 'info',
                    text: [
                        'ChatMe Terminal Commands & Keybindings:',
                        '  cd <dir>      Change working directory (supports ~, .., relative, absolute)',
                        '  pwd           Print current working directory',
                        '  clear / cls   Clear terminal output screen (or Ctrl+L)',
                        '  history       Print numbered history of executed commands',
                        '  exit          Close terminal drawer',
                        '  Ctrl+C        Cancel current running command / clear input line',
                        '  Up / Down     Navigate through command history',
                        '  Tab           Auto-complete paths or commands'
                    ].join('\n')
                }
            ]);
            return;
        }

        // 4. Built-in: history
        if (trimmed === 'history') {
            const historyText = commandHistory.length > 0 
                ? commandHistory.map((cmd, i) => `  ${(i + 1).toString().padStart(3, ' ')}  ${cmd}`).join('\n')
                : '  (history is empty)';
            setLines(prev => [
                ...prev,
                promptLine,
                { id: `hist-${Date.now()}`, type: 'stdout', text: historyText }
            ]);
            return;
        }

        // 5. Built-in: pwd
        if (trimmed === 'pwd') {
            setLines(prev => [
                ...prev,
                promptLine,
                { id: `pwd-${Date.now()}`, type: 'stdout', text: workingDirectory }
            ]);
            return;
        }

        // 6. Built-in: cd
        if (trimmed === 'cd' || trimmed.startsWith('cd ')) {
            const target = trimmed === 'cd' ? '~' : trimmed.slice(3).trim();
            try {
                const newDir = await changeDirectory(target);
                setWorkingDirectory(newDir);
                setLines(prev => [...prev, promptLine]);
            } catch (err: any) {
                setLines(prev => [
                    ...prev,
                    promptLine,
                    {
                        id: `cd-err-${Date.now()}`,
                        type: 'stderr',
                        text: err?.message || String(err)
                    }
                ]);
            }
            return;
        }

        // 7. System Shell execution
        setIsExecuting(true);
        setActiveRunningCmd(trimmed);
        const startTime = Date.now();

        // Append prompt line
        setLines(prev => [...prev, promptLine]);

        try {
            const result = await invoke<{
                stdout: string;
                stderr: string;
                exit_code: number;
                success: boolean;
            }>('execute_command', {
                command: trimmed,
                workingDirectory: workingDirectory || null,
                requestPermission: false
            });

            const duration = Date.now() - startTime;
            const newLines: TerminalLine[] = [];

            if (result.stdout) {
                newLines.push({
                    id: `out-${Date.now()}`,
                    type: 'stdout',
                    text: result.stdout.replace(/\r\n/g, '\n').replace(/\n$/, '')
                });
            }

            if (result.stderr) {
                newLines.push({
                    id: `err-${Date.now()}`,
                    type: 'stderr',
                    text: result.stderr.replace(/\r\n/g, '\n').replace(/\n$/, '')
                });
            }

            if (result.exit_code !== 0 && result.exit_code !== undefined) {
                newLines.push({
                    id: `code-${Date.now()}`,
                    type: 'system',
                    text: `[Process exited with code ${result.exit_code} (${duration}ms)]`,
                    exitCode: result.exit_code,
                    duration
                });
            }

            setLines(prev => [...prev, ...newLines]);
        } catch (error: any) {
            setLines(prev => [
                ...prev,
                {
                    id: `fail-${Date.now()}`,
                    type: 'stderr',
                    text: `Execution error: ${error?.message || String(error)}`
                }
            ]);
        } finally {
            setIsExecuting(false);
            setActiveRunningCmd('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Ctrl+L: Clear screen
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            setLines([]);
            return;
        }

        // Ctrl+C: Cancel current line or execution
        if (e.ctrlKey && e.key === 'c') {
            e.preventDefault();
            if (isExecuting) {
                setIsExecuting(false);
                setActiveRunningCmd('');
                setLines(prev => [
                    ...prev,
                    { id: `cancel-${Date.now()}`, type: 'system', text: '^C' }
                ]);
            } else {
                setCommand('');
            }
            return;
        }

        // Up arrow: Previous command
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length === 0) return;
            const nextIndex = historyIndex === null ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
            setHistoryIndex(nextIndex);
            setCommand(commandHistory[nextIndex]);
            return;
        }

        // Down arrow: Next command
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex !== null) {
                const nextIndex = historyIndex + 1;
                if (nextIndex < commandHistory.length) {
                    setHistoryIndex(nextIndex);
                    setCommand(commandHistory[nextIndex]);
                } else {
                    setHistoryIndex(null);
                    setCommand('');
                }
            }
            return;
        }

        // Tab: Auto-completion for common shell commands
        if (e.key === 'Tab') {
            e.preventDefault();
            const trimmed = command.trim();
            const commonCommands = ['git status', 'git diff', 'git log', 'npm test', 'npm run build', 'cargo check', 'ls -la', 'clear', 'history', 'pwd'];
            const match = commonCommands.find(c => c.startsWith(trimmed));
            if (match) {
                setCommand(match);
            }
        }
    };

    const handleCopyAll = () => {
        const fullOutput = lines.map(line => {
            if (line.type === 'prompt') {
                return `${username}@chatme:${line.cwd || '~'}$ ${line.text}`;
            }
            return line.text;
        }).join('\n');

        navigator.clipboard.writeText(fullOutput);
        setCopied(true);
        toast.success('Terminal output copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
    };

    const toggleHeight = () => {
        if (heightMode === 'normal') setHeightMode('expanded');
        else if (heightMode === 'expanded') setHeightMode('full');
        else setHeightMode('normal');
    };

    if (!isOpen) return null;

    const heightClass = heightMode === 'full' 
        ? 'h-[85vh]' 
        : heightMode === 'expanded' 
        ? 'h-[520px]' 
        : 'h-[300px]';

    return (
        <div 
            className={`fixed bottom-0 left-0 right-0 z-50 bg-[#0c0d10] text-zinc-100 border-t border-zinc-800/80 shadow-2xl flex flex-col transition-all duration-200 font-mono select-text ${heightClass}`}
            onClick={() => inputRef.current?.focus()}
        >
            {/* Terminal Top Window Bar */}
            <div 
                className="flex items-center justify-between px-3.5 py-1.5 border-b border-zinc-800/80 bg-zinc-900/90 text-xs select-none"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                    </div>
                    <div className="flex items-center gap-2 pl-1">
                        <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="font-semibold text-zinc-300 text-xs tracking-tight">Terminal</span>
                        <span className="text-[11px] text-zinc-500 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/50 truncate max-w-sm">
                            {getShortCwd(workingDirectory)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 text-zinc-400">
                    <button
                        onClick={handleCopyAll}
                        disabled={lines.length === 0}
                        className="p-1 rounded hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-30 cursor-pointer"
                        title="Copy entire terminal output"
                    >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button
                        onClick={() => setLines([])}
                        disabled={lines.length === 0}
                        className="p-1 rounded hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-30 cursor-pointer"
                        title="Clear terminal (Ctrl+L)"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={toggleHeight}
                        className="p-1 rounded hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                        title={heightMode === 'full' ? 'Restore standard size' : 'Expand terminal'}
                    >
                        {heightMode === 'full' ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:text-zinc-100 hover:bg-zinc-800 transition-colors ml-1 cursor-pointer"
                        title="Close terminal (Esc)"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Linewise Continuous Terminal Stream */}
            <div 
                ref={terminalContainerRef}
                className="flex-1 overflow-y-auto p-3 text-xs leading-relaxed space-y-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
            >
                {lines.map((line) => {
                    if (line.type === 'prompt') {
                        return (
                            <div key={line.id} className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
                                <span className="text-emerald-400 font-bold">{username}@chatme</span>
                                <span className="text-zinc-500">:</span>
                                <span className="text-blue-400 font-semibold">{line.cwd || '~'}</span>
                                <span className="text-zinc-400 font-bold">$</span>
                                <span className="text-zinc-100 font-medium">{line.text}</span>
                            </div>
                        );
                    }

                    if (line.type === 'stdout') {
                        return (
                            <div key={line.id} className="text-zinc-200 whitespace-pre-wrap break-words pl-0.5">
                                {line.text}
                            </div>
                        );
                    }

                    if (line.type === 'stderr') {
                        return (
                            <div key={line.id} className="text-rose-400 whitespace-pre-wrap break-words pl-0.5">
                                {line.text}
                            </div>
                        );
                    }

                    if (line.type === 'info') {
                        return (
                            <div key={line.id} className="text-zinc-500 whitespace-pre-wrap text-[11px] pl-0.5">
                                {line.text}
                            </div>
                        );
                    }

                    // System / process status
                    return (
                        <div key={line.id} className="text-zinc-500 text-[11px] italic pl-0.5">
                            {line.text}
                        </div>
                    );
                })}

                {/* Running process state */}
                {isExecuting && (
                    <div className="flex items-center gap-2 text-emerald-400/90 text-xs py-0.5 pl-0.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Running: {activeRunningCmd}</span>
                        <span className="text-zinc-600 text-[10px]">(press Ctrl+C to cancel)</span>
                    </div>
                )}

                {/* Active Interactive Prompt Line */}
                <form 
                    onSubmit={handleRunCommand}
                    className="flex items-center gap-1.5 pt-1 text-xs"
                    onClick={(e) => e.stopPropagation()}
                >
                    <span className="text-emerald-400 font-bold shrink-0">{username}@chatme</span>
                    <span className="text-zinc-500 shrink-0">:</span>
                    <span className="text-blue-400 font-semibold shrink-0">{getShortCwd(workingDirectory)}</span>
                    <span className="text-zinc-400 font-bold shrink-0">$</span>
                    <div className="flex-1 relative flex items-center min-w-[120px]">
                        <input
                            ref={inputRef}
                            type="text"
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isExecuting}
                            autoFocus
                            spellCheck={false}
                            autoCapitalize="off"
                            autoComplete="off"
                            className="w-full bg-transparent border-0 outline-none p-0 m-0 font-mono text-xs text-zinc-100 placeholder:text-zinc-700 focus:ring-0"
                            placeholder={isExecuting ? '' : 'type command...'}
                        />
                    </div>
                    {command.trim() && !isExecuting && (
                        <button
                            type="submit"
                            className="px-2 py-0.5 text-[10px] rounded bg-emerald-600/80 hover:bg-emerald-600 text-white font-mono flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                        >
                            <span>Enter</span>
                            <CornerDownLeft className="h-2.5 w-2.5" />
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}
