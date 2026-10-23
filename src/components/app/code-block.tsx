import React, { useState } from 'react';
import { Copy, Check, Play, Loader2, Terminal, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface CodeBlockProps {
    language?: string;
    value: string;
    children?: React.ReactNode;
}

interface CommandExecutionResult {
    stdout: string;
    stderr: string;
    exit_code?: number | null;
    success: boolean;
    execution_time_ms?: number;
}

export default function CodeBlock({ language = '', value, children }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [executionResult, setExecutionResult] = useState<CommandExecutionResult | null>(null);
    const [showOutput, setShowOutput] = useState(false);

    const cleanLang = (language || '').toLowerCase().replace(/^language-/, '').trim();
    const isDiff = cleanLang === 'diff' || cleanLang === 'patch';
    
    // Check if code block can be executed directly
    const isRunnable = [
        'bash', 'sh', 'shell', 'zsh', 'cmd', 'powershell', 'ps1',
        'python', 'py', 'javascript', 'js', 'node'
    ].includes(cleanLang);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success('Code copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Failed to copy code');
        }
    };

    const handleRunCode = async () => {
        setIsRunning(true);
        setShowOutput(true);
        const startTime = Date.now();

        try {
            let commandToExecute = value.trim();

            if (cleanLang === 'python' || cleanLang === 'py') {
                // Wrap python script execution
                commandToExecute = `python3 -c ${JSON.stringify(value)} 2>&1 || python -c ${JSON.stringify(value)}`;
            } else if (cleanLang === 'javascript' || cleanLang === 'js' || cleanLang === 'node') {
                // Wrap node execution
                commandToExecute = `node -e ${JSON.stringify(value)}`;
            }

            const result = await invoke<CommandExecutionResult>('execute_command', {
                command: commandToExecute,
                workingDirectory: null,
                requestPermission: false
            });

            setExecutionResult({
                stdout: result.stdout || '',
                stderr: result.stderr || '',
                exit_code: result.exit_code,
                success: result.success,
                execution_time_ms: result.execution_time_ms || (Date.now() - startTime)
            });

            if (result.success) {
                toast.success('Code executed successfully');
            } else {
                toast.warning('Code execution finished with errors');
            }
        } catch (error: any) {
            setExecutionResult({
                stdout: '',
                stderr: String(error?.message || error || 'Unknown execution error'),
                exit_code: 1,
                success: false,
                execution_time_ms: Date.now() - startTime
            });
            toast.error(`Execution failed: ${error?.message || error}`);
        } finally {
            setIsRunning(false);
        }
    };

    // Render interactive diff view if it's a diff
    const renderDiffContent = () => {
        const lines = value.split('\n');
        return (
            <div className="font-mono text-xs overflow-x-auto py-2 leading-relaxed select-text">
                {lines.map((line, idx) => {
                    let lineStyle = 'px-3 py-0.5 flex';
                    let badge = ' ';

                    if (line.startsWith('+') && !line.startsWith('+++')) {
                        lineStyle += ' bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-l-2 border-emerald-500';
                        badge = '+';
                    } else if (line.startsWith('-') && !line.startsWith('---')) {
                        lineStyle += ' bg-rose-500/15 text-rose-600 dark:text-rose-400 border-l-2 border-rose-500';
                        badge = '-';
                    } else if (line.startsWith('@@')) {
                        lineStyle += ' bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold my-1';
                        badge = '@';
                    } else {
                        lineStyle += ' text-muted-foreground';
                    }

                    return (
                        <div key={idx} className={lineStyle}>
                            <span className="w-5 shrink-0 opacity-60 select-none text-center font-bold">{badge}</span>
                            <span className="whitespace-pre">{line.replace(/^[+-]/, '') || ' '}</span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="my-3 rounded-xl border border-border/70 bg-card overflow-hidden shadow-sm">
            {/* Header bar */}
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-muted/60 border-b border-border/50 text-xs">
                <div className="flex items-center gap-2 font-mono font-medium text-muted-foreground uppercase tracking-wider text-[11px]">
                    <Terminal className="h-3.5 w-3.5 text-primary" />
                    <span>{cleanLang || 'code'}</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                    {isRunnable && (
                        <button
                            onClick={handleRunCode}
                            disabled={isRunning}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-colors disabled:opacity-50 cursor-pointer"
                            title={`Run in ${cleanLang}`}
                        >
                            {isRunning ? (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>Running...</span>
                                </>
                            ) : (
                                <>
                                    <Play className="h-3 w-3 fill-current" />
                                    <span>Run</span>
                                </>
                            )}
                        </button>
                    )}

                    <button
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title="Copy code"
                    >
                        {copied ? (
                            <>
                                <Check className="h-3 w-3 text-emerald-500" />
                                <span className="text-emerald-500 font-medium">Copied</span>
                            </>
                        ) : (
                            <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Code Body */}
            {isDiff ? (
                renderDiffContent()
            ) : (
                <div className="overflow-x-auto p-3 text-xs font-mono leading-relaxed bg-black/[0.02] dark:bg-black/20">
                    {children ? children : <pre className="m-0 p-0"><code>{value}</code></pre>}
                </div>
            )}

            {/* Execution Output Drawer */}
            {showOutput && executionResult && (
                <div className="border-t border-border/70 bg-zinc-950 text-zinc-100 dark:bg-black/80 p-3 font-mono text-xs">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 text-[11px] text-zinc-400">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1">
                                <span className={`h-2 w-2 rounded-full ${executionResult.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                {executionResult.success ? 'Success' : `Failed (exit ${executionResult.exit_code ?? 1})`}
                            </span>
                            {executionResult.execution_time_ms !== undefined && (
                                <span className="text-zinc-500">
                                    • {executionResult.execution_time_ms}ms
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setShowOutput(false)}
                            className="text-zinc-400 hover:text-zinc-100 p-0.5 rounded cursor-pointer"
                            title="Close output"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {executionResult.stdout && (
                        <div className="space-y-1">
                            <div className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">Output:</div>
                            <pre className="whitespace-pre-wrap break-words text-emerald-400/90 text-xs overflow-x-auto max-h-60">
                                {executionResult.stdout}
                            </pre>
                        </div>
                    )}

                    {executionResult.stderr && (
                        <div className="space-y-1 mt-2">
                            <div className="text-[10px] text-rose-400 font-semibold tracking-wider uppercase">Error:</div>
                            <pre className="whitespace-pre-wrap break-words text-rose-300 text-xs overflow-x-auto max-h-60">
                                {executionResult.stderr}
                            </pre>
                        </div>
                    )}

                    {!executionResult.stdout && !executionResult.stderr && (
                        <div className="text-zinc-500 italic text-[11px]">Process completed with no output.</div>
                    )}
                </div>
            )}
        </div>
    );
}
