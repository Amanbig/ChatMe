import { invoke } from '@tauri-apps/api/core';
import type { DirectoryContents, SearchResult } from './types';

// Simple agent queries that can be handled locally
export async function handleAgentQuery(query: string, workingDirectory: string): Promise<string | null> {
    const lowerQuery = query.toLowerCase().trim();
    
    // Current directory queries
    if (lowerQuery.includes('current directory') || 
        lowerQuery.includes('current dir') ||
        lowerQuery.includes('working directory') ||
        lowerQuery.includes('pwd')) {
        
        if (workingDirectory) {
            return `Current working directory: ${workingDirectory}`;
        } else {
            // Try to get system current directory
            try {
                const result = await invoke('get_current_directory') as string;
                return `Current working directory: ${result}`;
            } catch (error) {
                return "No working directory set. Please set one in the Agent Mode settings.";
            }
        }
    }
    
    // List files queries
    if (lowerQuery.includes('list files') || 
        lowerQuery.includes('show files') ||
        lowerQuery.includes('files in') ||
        (lowerQuery.includes('ls') && workingDirectory)) {
        
        try {
            const directory = workingDirectory || '.';
            const result = await invoke('read_directory', { 
                directoryPath: directory, 
                recursive: false 
            }) as DirectoryContents;
            
            if (result && result.files) {
                const fileList = result.files.map(file => `- ${file.name}`).join('\n');
                return `Files in ${directory}:\n${fileList}`;
            } else {
                return `No files found in ${directory}`;
            }
        } catch (error) {
            return `Error reading directory: ${error}`;
        }
    }
    
    // Search queries
    if (lowerQuery.includes('search for') || 
        lowerQuery.includes('find') ||
        lowerQuery.includes('grep')) {
        
        // Extract search pattern (simple heuristic)
        const searchMatch = lowerQuery.match(/(?:search for|find|grep)\s+["']?([^"']+)["']?/);
        if (searchMatch && workingDirectory) {
            const pattern = searchMatch[1];
            
            try {
                const result = await invoke('search_files', {
                    directoryPath: workingDirectory,
                    pattern: pattern,
                    recursive: true,
                    maxResults: 20
                }) as SearchResult[];
                
                if (result && result.length > 0) {
                    const resultList = result.map(item => 
                        `- ${item.file_path}:${item.line_number}: ${item.line_content.trim()}`
                    ).join('\n');
                    return `Search results for "${pattern}":\n${resultList}`;
                } else {
                    return `No results found for "${pattern}" in ${workingDirectory}`;
                }
            } catch (error) {
                return `Error searching files: ${error}`;
            }
        }
    }
    
    // Return null if query can't be handled locally
    return null;
}

// Check if a query can be handled by the agent
export function isAgentQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase().trim();
    
    const agentKeywords = [
        'current directory', 'current dir', 'working directory', 'pwd',
        'list files', 'show files', 'files in', 'ls',
        'search for', 'find', 'grep',
        'read file', 'open file',
        'directory', 'folder'
    ];
    
    return agentKeywords.some(keyword => lowerQuery.includes(keyword));
}
