import { invoke } from '@tauri-apps/api/core';
import type { DirectoryContents, SearchResult } from './types';

// Simple agent queries that can be handled locally using built-in functions
export async function handleAgentQuery(query: string, workingDirectory: string): Promise<string | null> {
    const lowerQuery = query.toLowerCase().trim();
    
    // Current directory queries
    if (lowerQuery.includes('current directory') || 
        lowerQuery.includes('current dir') ||
        lowerQuery.includes('working directory') ||
        lowerQuery.includes('pwd')) {
        
        try {
            const result = await invoke('get_current_directory') as string;
            return `**Current working directory:**\n\`${result}\``;
        } catch (error) {
            return `Error getting current directory: ${error}`;
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
                    const fullPath = `${directory}/${file.name}`.replace(/\\/g, '/');
                    return `${icon} [${file.name}](file://${fullPath})`;
                }).join('\n');
                
                const dirList = result.directories ? result.directories.map(dir => {
                    const fullPath = `${directory}/${dir.name}`.replace(/\\/g, '/');
                    return `📁 [${dir.name}/](file://${fullPath})`;
                }).join('\n') : '';
                
                const sections = [];
                if (dirList) sections.push(`**Directories:**\n${dirList}`);
                if (fileList) sections.push(`**Files:**\n${fileList}`);
                
                const fullList = sections.join('\n\n');
                return `**Files and folders in ${directory}:**\n\n${fullList}\n\n*Click on any item to open it*`;
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
        
        // Extract search pattern
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
                        const filePath = item.file_path.replace(/\\/g, '/');
                        return `📄 **[${fileName}](file://${filePath})** (Line ${item.line_number})\n\`\`\`\n${item.line_content.trim()}\n\`\`\``;
                    }).join('\n\n');
                    return `**Search results for "${pattern}" (${result.length} matches):**\n\n${resultList}\n\n*Click on any file to open it*`;
                } else {
                    return `No results found for "${pattern}" in ${workingDirectory}`;
                }
            } catch (error) {
                return `Error searching files: ${error}`;
            }
        }
    }
    
    // Read file queries
    if (lowerQuery.includes('read file') || 
        lowerQuery.includes('show content') ||
        lowerQuery.includes('cat ')) {
        
        const fileMatch = lowerQuery.match(/(?:read file|show content|cat)\s+["']?([^"']+)["']?/);
        if (fileMatch) {
            try {
                const content = await invoke('read_file', { filePath: fileMatch[1] }) as string;
                const fileName = fileMatch[1].split(/[/\\]/).pop();
                return `**Content of ${fileName}:**\n\n\`\`\`\n${content}\n\`\`\``;
            } catch (error) {
                return `Error reading file: ${error}`;
            }
        }
    }
    
    // If no pattern matched, return null
    return null;
}

// Function to determine if a query should be handled by agent
export function isAgentQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase().trim();
    
    // Check for patterns that indicate agent actions
    const agentPatterns = [
        'current directory', 'current dir', 'working directory', 'pwd',
        'list files', 'show files', 'files in', 'ls ',
        'search for', 'find ', 'grep ',
        'read file', 'show content', 'cat '
    ];
    
    return agentPatterns.some(pattern => lowerQuery.includes(pattern));
}
