export interface SubAgentRole {
    id: string;
    title: string;
    name: string;
    avatar: string;
    color: string;
    description: string;
    systemPrompt: string;
}

export interface AgentTask {
    id: string;
    roleId: string;
    task: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: string;
    startedAt?: string;
    completedAt?: string;
}

export const SUB_AGENTS: Record<string, SubAgentRole> = {
    planner: {
        id: 'planner',
        name: 'Architecture & Planning Agent',
        title: 'Planner',
        avatar: '🧠',
        color: 'from-amber-500 to-orange-500',
        description: 'Analyzes user goals, decomposes complex tasks into phased milestones, and establishes execution roadmaps.',
        systemPrompt: 'You are the Architecture & Planning Agent. You create structured, step-by-step action plans, risk assessments, and checklists.'
    },
    coder: {
        id: 'coder',
        name: 'Full-Stack Engineering Agent',
        title: 'Coder',
        avatar: '💻',
        color: 'from-blue-500 to-indigo-600',
        description: 'Writes production-grade code, refactors components, creates files, and runs diffs.',
        systemPrompt: 'You are the Full-Stack Engineering Agent. You write clean, modular, and performant code adhering to best design patterns.'
    },
    researcher: {
        id: 'researcher',
        name: 'Research & Web Intelligence Agent',
        title: 'Researcher',
        avatar: '🔍',
        color: 'from-emerald-500 to-teal-600',
        description: 'Gathers facts, searches workspace files, inspects external documentation, and summarizes technical references.',
        systemPrompt: 'You are the Research & Intelligence Agent. You locate relevant files, scrape documentation, and provide concise factual synthesis.'
    },
    reviewer: {
        id: 'reviewer',
        name: 'Code Quality & Security Reviewer',
        title: 'Reviewer',
        avatar: '🛡️',
        color: 'from-rose-500 to-pink-600',
        description: 'Audits implementations for vulnerabilities, performance bottlenecks, and edge cases.',
        systemPrompt: 'You are the Security & Quality Reviewer. You analyze proposed changes for safety, memory leaks, and correctness.'
    },
    system: {
        id: 'system',
        name: 'System & DevOps Operator',
        title: 'DevOps',
        avatar: '⚡',
        color: 'from-violet-500 to-purple-600',
        description: 'Manages terminal commands, background processes, environment setups, and package builds.',
        systemPrompt: 'You are the System & DevOps Operator. You inspect system diagnostics, run commands safely, and report outputs.'
    }
};

/**
 * Detect subagent delegation markers in model response
 * Formats supported:
 * [SUMMON_AGENT:{"role":"coder","task":"implement x"}]
 * [DELEGATE:{"agent":"researcher","task":"search y"}]
 */
export function extractAgentDelegations(response: string): Array<{ raw: string; role: string; task: string }> {
    const delegations: Array<{ raw: string; role: string; task: string }> = [];
    const summonRegex = /\[(?:SUMMON_AGENT|DELEGATE):({[^}]+})\]/g;
    let match;

    while ((match = summonRegex.exec(response)) !== null) {
        try {
            const data = JSON.parse(match[1]);
            const role = (data.role || data.agent || 'planner').toLowerCase();
            const task = data.task || data.objective || 'Task execution';
            delegations.push({
                raw: match[0],
                role,
                task
            });
        } catch {
            // Ignore malformed markers
        }
    }

    return delegations;
}
