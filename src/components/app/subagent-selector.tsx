import { useState } from 'react';
import { SUB_AGENTS, type SubAgentRole } from '@/lib/multi-agent';
import { Users, ChevronDown, Check } from 'lucide-react';

interface SubagentSelectorProps {
    activeRole: string; // 'auto' or role id
    onSelectRole: (roleId: string) => void;
}

export default function SubagentSelector({ activeRole, onSelectRole }: SubagentSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const activeAgent: SubAgentRole | null = SUB_AGENTS[activeRole] || null;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50 transition-colors cursor-pointer"
                title="Select Specialized Sub-Agent or Multi-Agent Swarm"
            >
                <Users className="h-3 w-3 text-primary" />
                <span>
                    {activeRole === 'auto' ? 'Agent Swarm (Auto)' : activeAgent?.title || 'Agent Team'}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl bg-popover/95 backdrop-blur-md border border-border/80 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 mb-1">
                            Summon Specialized Sub-Agent
                        </div>

                        {/* Auto Swarm Option */}
                        <button
                            type="button"
                            onClick={() => {
                                onSelectRole('auto');
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                                activeRole === 'auto'
                                    ? 'bg-primary/10 border border-primary/20 text-foreground font-medium'
                                    : 'hover:bg-muted/70 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-base">🤖</span>
                                <div>
                                    <div className="text-foreground font-semibold">Autonomous Swarm</div>
                                    <div className="text-[10px] text-muted-foreground">Auto-delegates to specialized sub-agents</div>
                                </div>
                            </div>
                            {activeRole === 'auto' && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </button>

                        {/* List of sub-agents */}
                        <div className="space-y-0.5 mt-1">
                            {Object.values(SUB_AGENTS).map((agent) => {
                                const selected = activeRole === agent.id;
                                return (
                                    <button
                                        key={agent.id}
                                        type="button"
                                        onClick={() => {
                                            onSelectRole(agent.id);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                                            selected
                                                ? 'bg-primary/10 border border-primary/20 text-foreground font-medium'
                                                : 'hover:bg-muted/70 text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">{agent.avatar}</span>
                                            <div>
                                                <div className="text-foreground font-medium">{agent.name}</div>
                                                <div className="text-[10px] text-muted-foreground line-clamp-1">{agent.description}</div>
                                            </div>
                                        </div>
                                        {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
