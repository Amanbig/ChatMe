import { invoke } from '@tauri-apps/api/core';

export interface ConnectedApp {
    id: string;
    name: string;
    icon: string;
    description: string;
    type: 'ide' | 'browser' | 'terminal' | 'files' | 'custom';
    status: 'connected' | 'available' | 'disconnected';
    contextData?: Record<string, any>;
}

export const COMMON_APPS: ConnectedApp[] = [
    {
        id: 'vscode',
        name: 'VS Code',
        icon: '💻',
        description: 'Connect to workspace files, active editors & project context',
        type: 'ide',
        status: 'available'
    },
    {
        id: 'terminal',
        name: 'Developer Terminal',
        icon: '🖥️',
        description: 'Direct shell execution, npm scripts & git operations',
        type: 'terminal',
        status: 'available'
    },
    {
        id: 'browser',
        name: 'Web Browser',
        icon: '🌐',
        description: 'Fetch documentation, inspect web URLs & APIs',
        type: 'browser',
        status: 'available'
    },
    {
        id: 'finder',
        name: 'File Manager',
        icon: '📁',
        description: 'Explore directory structure and manage workspace assets',
        type: 'files',
        status: 'available'
    }
];

/**
 * Scan running processes and installed applications to find desktop integrations
 */
export async function detectDesktopApps(): Promise<ConnectedApp[]> {
    try {
        const detected = [...COMMON_APPS];
        
        // Check running processes if available
        try {
            const processesResult = await invoke<any>('get_processes');
            const procList = Array.isArray(processesResult) ? processesResult : (processesResult?.processes || []);
            const procNames = (procList as Array<{ name?: string }>).map(p => (p.name || '').toLowerCase());

            return detected.map(app => {
                const isRunning = procNames.some(name => 
                    (app.id === 'vscode' && (name.includes('code') || name.includes('cursor'))) ||
                    (app.id === 'browser' && (name.includes('chrome') || name.includes('firefox') || name.includes('edge') || name.includes('brave'))) ||
                    (app.id === 'terminal' && (name.includes('bash') || name.includes('zsh') || name.includes('terminal') || name.includes('alacritty') || name.includes('wezterm'))) ||
                    (app.id === 'finder' && (name.includes('nautilus') || name.includes('explorer') || name.includes('finder') || name.includes('thunar')))
                );

                return {
                    ...app,
                    status: isRunning ? 'connected' : 'available'
                };
            });
        } catch {
            return detected;
        }
    } catch (error) {
        console.error('Failed to detect desktop apps:', error);
        return COMMON_APPS;
    }
}

/**
 * Get current context prompt addition for active connected apps
 */
export function getConnectedAppsContext(apps: ConnectedApp[], workingDirectory?: string): string {
    if (!apps || apps.length === 0) return '';

    let promptContext = '\n\n[CONNECTED DESKTOP APPLICATIONS & INTEGRATIONS]:\n';
    for (const app of apps) {
        promptContext += `- **${app.name}** (${app.type}): Active connection.`;
        if (app.id === 'terminal' || app.id === 'vscode') {
            promptContext += ` Current Workspace Directory: \`${workingDirectory || '.'}\`.`;
        }
        if (app.id === 'browser') {
            promptContext += ` For looking up online docs, repositories, news, or general web search, use the web_search / duckduckgo_search tools.`;
        }
        promptContext += '\n';
    }
    promptContext += 'You have user-authorized access to read context and perform operations for these connected apps.\n';
    return promptContext;
}
