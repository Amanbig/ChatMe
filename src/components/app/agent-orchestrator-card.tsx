import { useState } from 'react';
import { SUB_AGENTS, type SubAgentRole } from '@/lib/multi-agent';
import { ChevronDown, ChevronUp, CheckCircle, Clock, Sparkles } from 'lucide-react';

interface AgentOrchestratorCardProps {
    roleId: string;
    task: string;
    status?: 'running' | 'completed' | 'pending';
    result?: string;
}

export default function AgentOrchestratorCard({
    roleId,
    task,
    status = 'completed',
    result
}: AgentOrchestratorCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const agent: SubAgentRole = SUB_AGENTS[roleId] || {
        id: roleId,
        name: `${roleId.charAt(0).toUpperCase() + roleId.slice(1)} Agent`,
        title: roleId,
        avatar: '🤖',
        color: 'from-blue-500 to-indigo-600',
        description: 'Specialized subagent',
        systemPrompt: ''
    };

    return (
        <div className="my-2.5 rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm overflow-hidden shadow-xs hover:border-primary/40 transition-colors">
            {/* Header */}
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between p-3 cursor-pointer bg-muted/40 hover:bg-muted/70 transition-colors select-none text-xs"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border border-primary/20 text-sm">
                        {agent.avatar}
                    </div>

                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <span>{agent.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
                                Sub-Agent
                            </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-md">
                            {task}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {status === 'completed' ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Done</span>
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-amber-500 animate-pulse">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Working...</span>
                        </span>
                    )}

                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
            </div>

            {/* Expanded Body */}
            {isExpanded && (
                <div className="p-3 border-t border-border/50 bg-background/50 text-xs space-y-2">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-primary" />
                        Delegated Objective:
                    </div>
                    <div className="font-mono text-[11px] bg-muted/50 p-2 rounded-lg text-foreground/90 whitespace-pre-wrap">
                        {task}
                    </div>

                    {result && (
                        <>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold pt-1">
                                Execution Output:
                            </div>
                            <div className="font-mono text-xs bg-black/5 dark:bg-black/30 p-2.5 rounded-lg border border-border/40 whitespace-pre-wrap text-foreground/90 max-h-56 overflow-y-auto">
                                {result}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
