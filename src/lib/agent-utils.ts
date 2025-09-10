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
                const fileList = result.files.map(file => {
                    const icon = file.is_directory ? "📁" : "📄";
                    return `${icon} [Open](file://${directory}/${file.name}) **${file.name}**`;
                }).join('\n');
                
                const dirList = result.directories ? result.directories.map(dir => {
                    return `📁 [Open](file://${directory}/${dir.name}) **${dir.name}/**`;
                }).join('\n') : '';
                
                const fullList = [dirList, fileList].filter(Boolean).join('\n');
                return `Files and folders in ${directory}:\n\n${fullList}\n\n*Click on any item to open it*`;
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
                    const resultList = result.map(item => {
                        const fileName = item.file_path.split(/[/\\]/).pop();
                        return `📄 [${fileName}](file://${item.file_path}) (Line ${item.line_number})\n   \`${item.line_content.trim()}\``;
                    }).join('\n\n');
                    return `Search results for "${pattern}" (${result.length} matches):\n\n${resultList}\n\n*Click on any file to open it*`;
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
