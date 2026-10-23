import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
    FaCheck,
    FaTimes,
    FaCog,
    FaTerminal,
    FaFolderOpen,
    FaEdit,
    FaGlobe,
    FaRocket,
    FaChevronDown,
    FaChevronUp,
    FaCopy,
    FaSpinner
} from 'react-icons/fa';
import type { ToolExecution } from '@/lib/types';

interface ToolExecutionDisplayProps {
    executions: ToolExecution[];
}

export default function ToolExecutionDisplay({ executions }: ToolExecutionDisplayProps) {
    const [expandedExecutions, setExpandedExecutions] = useState<Set<string>>(new Set());

    const toggleExpanded = (toolCallId: string) => {
        setExpandedExecutions(prev => {
            const next = new Set(prev);
            if (next.has(toolCallId)) {
                next.delete(toolCallId);
            } else {
                next.add(toolCallId);
            }
            return next;
        });
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`Copied ${label} to clipboard`);
    };

    if (!executions || executions.length === 0) {
        return null;
    }

    const getToolMeta = (toolName: string) => {
        switch (toolName) {
            case 'execute_command':
            case 'run_command':
                return {
                    name: 'Terminal Command',
                    icon: <FaTerminal className="text-amber-500 shrink-0" size={12} />,
                    color: 'border-amber-500/30 bg-amber-500/5'
                };
            case 'read_file':
                return {
                    name: 'Read File',
                    icon: <FaFolderOpen className="text-blue-500 shrink-0" size={12} />,
                    color: 'border-blue-500/30 bg-blue-500/5'
                };
            case 'read_document':
                return {
                    name: 'Read Document (PDF/Text)',
                    icon: <FaFolderOpen className="text-blue-500 shrink-0" size={12} />,
                    color: 'border-blue-500/30 bg-blue-500/5'
                };
            case 'write_file':
                return {
                    name: 'Write File',
                    icon: <FaEdit className="text-purple-500 shrink-0" size={12} />,
                    color: 'border-purple-500/30 bg-purple-500/5'
                };
            case 'fetch_url':
                return {
                    name: 'Web Request',
                    icon: <FaGlobe className="text-emerald-500 shrink-0" size={12} />,
                    color: 'border-emerald-500/30 bg-emerald-500/5'
                };
            case 'duckduckgo_search':
            case 'web_search':
                return {
                    name: 'DuckDuckGo Web Search',
                    icon: <FaGlobe className="text-cyan-500 shrink-0" size={12} />,
                    color: 'border-cyan-500/30 bg-cyan-500/5'
                };
            case 'search_files':
                return {
                    name: 'Search Files',
                    icon: <FaFolderOpen className="text-blue-500 shrink-0" size={12} />,
                    color: 'border-blue-500/30 bg-blue-500/5'
                };
            case 'launch_app':
            case 'get_installed_apps':
                return {
                    name: 'Application Bridge',
                    icon: <FaRocket className="text-indigo-500 shrink-0" size={12} />,
                    color: 'border-indigo-500/30 bg-indigo-500/5'
                };
            default:
                return {
                    name: toolName.replace(/^mcp_/, '').replace(/_/g, ' '),
                    icon: <FaCog className="text-primary shrink-0" size={12} />,
                    color: 'border-border/60 bg-muted/30'
                };
        }
    };

    const getPrimaryParam = (exec: ToolExecution) => {
        const args = exec.arguments || {};
        if (args.command) return `$ ${args.command}`;
        if (args.query) return `🔍 ${args.query}`;
        if (args.pattern) return `🔎 "${args.pattern}" in ${args.directory || '.'}`;
        if (args.path || args.file_path) return args.path || args.file_path;
        if (args.url) return args.url;
        if (args.app_path) return args.app_path;

        const keys = Object.keys(args);
        if (keys.length === 1) {
            const val = args[keys[0]];
            return typeof val === 'string' ? val : JSON.stringify(val);
        }
        return '';
    };

    return (
        <div className="space-y-2 my-2.5">
            {executions.map((exec) => {
                const isExpanded = expandedExecutions.has(exec.tool_call_id);
                const meta = getToolMeta(exec.tool_name);
                const paramSummary = getPrimaryParam(exec);
                const isRunning = exec.result === null && exec.error_message === null && !exec.success;

                return (
                    <div
                        key={exec.tool_call_id}
                        className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                            isExpanded ? 'border-border/80 bg-card shadow-xs' : 'border-border/50 bg-muted/20 hover:bg-muted/40'
                        }`}
                    >
                        {/* Header Bar */}
                        <div
                            onClick={() => toggleExpanded(exec.tool_call_id)}
                            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none"
                        >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                {meta.icon}
                                <span className="text-xs font-semibold text-foreground tracking-tight shrink-0">
                                    {meta.name}
                                </span>

                                {paramSummary && (
                                    <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[280px] sm:max-w-md bg-muted/60 px-2 py-0.5 rounded border border-border/40">
                                        {paramSummary}
                                    </span>
                                )}
                            </div>

                            {/* Status badge */}
                            <div className="flex items-center gap-2 shrink-0">
                                {isRunning ? (
                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1 font-mono text-amber-500 border-amber-500/30 bg-amber-500/10">
                                        <FaSpinner className="animate-spin" size={9} />
                                        Running
                                    </Badge>
                                ) : exec.success ? (
                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1 font-mono text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                                        <FaCheck size={9} />
                                        Success
                                    </Badge>
                                ) : (
                                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px] gap-1 font-mono">
                                        <FaTimes size={9} />
                                        Failed
                                    </Badge>
                                )}

                                <button
                                    type="button"
                                    className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded cursor-pointer"
                                    title={isExpanded ? 'Collapse' : 'Expand'}
                                >
                                    {isExpanded ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                                </button>
                            </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                            <div className="p-3 border-t border-border/40 space-y-3 bg-muted/10 text-xs">
                                {/* Parameters */}
                                {exec.arguments && Object.keys(exec.arguments).length > 0 && (
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                            Arguments
                                        </span>
                                        <pre className="rounded-lg bg-background p-2.5 font-mono text-[11px] border border-border/50 overflow-x-auto text-foreground/90 max-h-36">
                                            {JSON.stringify(exec.arguments, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {/* Output / Result */}
                                {exec.result !== null && (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                Tool Output
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const resText = typeof exec.result === 'string'
                                                        ? exec.result
                                                        : JSON.stringify(exec.result, null, 2);
                                                    copyToClipboard(resText, 'tool output');
                                                }}
                                                className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                                            >
                                                <FaCopy size={10} />
                                                Copy
                                            </Button>
                                        </div>
                                        <pre className="rounded-lg bg-black/85 text-emerald-400 p-2.5 font-mono text-[11px] border border-border/40 overflow-x-auto max-h-52 leading-relaxed">
                                            {typeof exec.result === 'string'
                                                ? exec.result
                                                : JSON.stringify(exec.result, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {/* Error */}
                                {!exec.success && exec.error_message && (
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-semibold text-destructive uppercase tracking-wider">
                                            Error Details
                                        </span>
                                        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-2.5 text-destructive font-mono text-[11px]">
                                            {exec.error_message}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40 font-mono">
                                    <span>ID: {exec.tool_call_id}</span>
                                    <span>{new Date(exec.timestamp).toLocaleTimeString()}</span>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
