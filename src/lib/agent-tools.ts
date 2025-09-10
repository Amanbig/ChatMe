import { invoke } from '@tauri-apps/api/core';
import type { DirectoryContents, SearchResult } from './types';

export interface AgentTool {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, any>;
        required: string[];
    };
    execute: (params: Record<string, any>) => Promise<string>;
}

// Tool: Get current directory
export const getCurrentDirectoryTool: AgentTool = {
    name: "get_current_directory",
    description: "Get the current working directory",
    parameters: {
        type: "object",
        properties: {},
        required: []
    },
    execute: async () => {
        try {
            const result = await invoke('get_current_directory') as string;
            return `**Current working directory:**\n\`${result}\``;
        } catch (error) {
            return `Error getting current directory: ${error}`;
        }
    }
};

// Tool: List files and directories
export const listFilesTool: AgentTool = {
    name: "list_files",
    description: "List files and directories in a given path",
    parameters: {
        type: "object",
        properties: {
            directory: {
                type: "string",
                description: "The directory path to list"
            },
            recursive: {
                type: "boolean",
                description: "Whether to list recursively",
                default: false
            }
        },
        required: ["directory"]
    },
    execute: async (params) => {
        try {
            const result = await invoke('read_directory', {
                directoryPath: params.directory,
                recursive: params.recursive || false
            }) as DirectoryContents;

            if (result && result.files) {
                const fileList = result.files.map(file => {
                    const icon = file.is_directory ? "📁" : "📄";
                    const fullPath = `${params.directory}/${file.name}`.replace(/\\/g, '/');
                    return `${icon} [${file.name}](file://${fullPath})`;
                }).join('\n');

                const dirList = result.directories ? result.directories.map(dir => {
                    const fullPath = `${params.directory}/${dir.name}`.replace(/\\/g, '/');
                    return `📁 [${dir.name}/](file://${fullPath})`;
                }).join('\n') : '';

                const sections = [];
                if (dirList) sections.push(`**Directories:**\n${dirList}`);
                if (fileList) sections.push(`**Files:**\n${fileList}`);

                const fullList = sections.join('\n\n');
                return `**Files and folders in ${params.directory}:**\n\n${fullList}\n\n*Click on any item to open it*`;
            } else {
                return `No files found in ${params.directory}`;
            }
        } catch (error) {
            return `Error reading directory: ${error}`;
        }
    }
};

// Tool: Search files
export const searchFilesTool: AgentTool = {
    name: "search_files",
    description: "Search for text patterns in files",
    parameters: {
        type: "object",
        properties: {
            directory: {
                type: "string",
                description: "The directory to search in"
            },
            pattern: {
                type: "string",
                description: "The text pattern to search for"
            },
            file_extension: {
                type: "string",
                description: "Filter by file extension (optional)"
            },
            case_sensitive: {
                type: "boolean",
                description: "Whether the search should be case sensitive",
                default: false
            },
            max_results: {
                type: "number",
                description: "Maximum number of results to return",
                default: 20
            }
        },
        required: ["directory", "pattern"]
    },
    execute: async (params) => {
        try {
            const result = await invoke('search_files', {
                directoryPath: params.directory,
                pattern: params.pattern,
                fileExtension: params.file_extension,
                caseSensitive: params.case_sensitive || false,
                recursive: true,
                maxResults: params.max_results || 20
            }) as SearchResult[];

            if (result && result.length > 0) {
                const resultList = result.map(item => {
                    const fileName = item.file_path.split(/[/\\]/).pop();
                    const filePath = item.file_path.replace(/\\/g, '/');
                    return `📄 **[${fileName}](file://${filePath})** (Line ${item.line_number})\n\`\`\`\n${item.line_content.trim()}\n\`\`\``;
                }).join('\n\n');
                return `**Search results for "${params.pattern}" (${result.length} matches):**\n\n${resultList}\n\n*Click on any file to open it*`;
            } else {
                return `No results found for "${params.pattern}" in ${params.directory}`;
            }
        } catch (error) {
            return `Error searching files: ${error}`;
        }
    }
};

// Tool: Read file content
export const readFileTool: AgentTool = {
    name: "read_file",
    description: "Read the contents of a file",
    parameters: {
        type: "object",
        properties: {
            file_path: {
                type: "string",
                description: "The path to the file to read"
            }
        },
        required: ["file_path"]
    },
    execute: async (params) => {
        try {
            const content = await invoke('read_file', { filePath: params.file_path }) as string;
            const fileName = params.file_path.split(/[/\\]/).pop();
            return `**Content of ${fileName}:**\n\n\`\`\`\n${content}\n\`\`\``;
        } catch (error) {
            return `Error reading file: ${error}`;
        }
    }
};

// Registry of all available tools
export const AGENT_TOOLS: Record<string, AgentTool> = {
    get_current_directory: getCurrentDirectoryTool,
    list_files: listFilesTool,
    search_files: searchFilesTool,
    read_file: readFileTool
};

// Function to detect if a query should use tools and which tool to use
export function detectToolUsage(query: string, workingDirectory: string): { tool: AgentTool; params: Record<string, any> } | null {
    const lowerQuery = query.toLowerCase().trim();
    
    // Current directory queries
    if (lowerQuery.includes('current directory') || 
        lowerQuery.includes('current dir') ||
        lowerQuery.includes('working directory') ||
        lowerQuery.includes('pwd')) {
        return {
            tool: getCurrentDirectoryTool,
            params: {}
        };
    }
    
    // List files queries
    if (lowerQuery.includes('list files') || 
        lowerQuery.includes('show files') ||
        lowerQuery.includes('files in') ||
        (lowerQuery.includes('ls') && workingDirectory)) {
        
        // Try to extract directory from query
        let directory = workingDirectory || '.';
        const dirMatch = lowerQuery.match(/(?:files in|list files in|ls)\s+["']?([^"']+)["']?/);
        if (dirMatch) {
            directory = dirMatch[1];
        }
        
        return {
            tool: listFilesTool,
            params: { directory }
        };
    }
    
    // Search queries
    if (lowerQuery.includes('search for') || 
        lowerQuery.includes('find') ||
        lowerQuery.includes('grep')) {
        
        // Extract search pattern
        const searchMatch = lowerQuery.match(/(?:search for|find|grep)\s+["']?([^"']+)["']?/);
        if (searchMatch && workingDirectory) {
            const pattern = searchMatch[1];
            return {
                tool: searchFilesTool,
                params: { 
                    directory: workingDirectory,
                    pattern: pattern
                }
            };
        }
    }
    
    // Read file queries
    if (lowerQuery.includes('read file') || 
        lowerQuery.includes('show content') ||
        lowerQuery.includes('cat ')) {
        
        const fileMatch = lowerQuery.match(/(?:read file|show content|cat)\s+["']?([^"']+)["']?/);
        if (fileMatch) {
            return {
                tool: readFileTool,
                params: { file_path: fileMatch[1] }
            };
        }
    }
    
    return null;
}
