import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AgentContextType {
    isAgentActive: boolean;
    workingDirectory: string;
    setAgentActive: (active: boolean) => void;
    setWorkingDirectory: (path: string) => void;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
    const [isAgentActive, setIsAgentActive] = useState(false);
    const [workingDirectory, setWorkingDirectoryState] = useState('');

    const setAgentActive = (active: boolean) => {
        setIsAgentActive(active);
        // Store in localStorage for persistence
        localStorage.setItem('agentMode', JSON.stringify(active));
    };

    const setWorkingDirectory = (path: string) => {
        setWorkingDirectoryState(path);
        // Store in localStorage for persistence
        localStorage.setItem('agentWorkingDirectory', path);
    };

    // Initialize from localStorage
    useEffect(() => {
        const savedAgentMode = localStorage.getItem('agentMode');
        const savedWorkingDir = localStorage.getItem('agentWorkingDirectory');
        
        if (savedAgentMode) {
            setIsAgentActive(JSON.parse(savedAgentMode));
        }
        if (savedWorkingDir) {
            setWorkingDirectoryState(savedWorkingDir);
        }
    }, []);

    return (
        <AgentContext.Provider value={{
            isAgentActive,
            workingDirectory,
            setAgentActive,
            setWorkingDirectory
        }}>
            {children}
        </AgentContext.Provider>
    );
}

export function useAgent() {
    const context = useContext(AgentContext);
    if (context === undefined) {
        throw new Error('useAgent must be used within an AgentProvider');
    }
    return context;
}
