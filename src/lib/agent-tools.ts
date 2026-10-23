import { invoke } from '@tauri-apps/api/core';
import type { DirectoryContents, SearchResult, DocumentContent, WebSearchResult } from './types';

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

// Tool: Read document / file content (supports PDF, TXT, MD, CSV, JSON, code, etc.)
export const readDocumentTool: AgentTool = {
    name: "read_document",
    description: "Extract text from documents and files including PDF (.pdf), plain text (.txt), Markdown (.md), JSON (.json), CSV (.csv), and source code files.",
    parameters: {
        type: "object",
        properties: {
            file_path: {
                type: "string",
                description: "The path of the file to read (supports .pdf, .txt, .md, .csv, .json, source code, etc.)"
            },
            max_length: {
                type: "number",
                description: "Optional maximum characters to extract (default: 100,000)"
            }
        },
        required: ["file_path"]
    },
    execute: async (params) => {
        try {
            const doc = await invoke('read_document', { 
                filePath: params.file_path,
                maxLength: params.max_length
            }) as DocumentContent;
            
            const pageStr = doc.page_count ? ` (${doc.page_count} pages)` : '';
            const truncStr = doc.is_truncated ? ' [Content truncated due to length limit]' : '';
            return `**Extracted from ${doc.file_name}${pageStr} [Type: ${doc.file_type}, ${doc.line_count} lines]:**\n\n${doc.content}${truncStr ? '\n\n' + truncStr : ''}`;
        } catch (error) {
            return `Error reading document: ${error}`;
        }
    }
};

// Tool: Write file content
export const writeFileTool: AgentTool = {
    name: "write_file",
    description: "Write or create a file with given content",
    parameters: {
        type: "object",
        properties: {
            file_path: {
                type: "string",
                description: "The path of the file to write to"
            },
            content: {
                type: "string",
                description: "The textual content to write into the file"
            }
        },
        required: ["file_path", "content"]
    },
    execute: async (params) => {
        try {
            await invoke('write_file', { 
                filePath: params.file_path, 
                contents: params.content 
            });
            const fileName = params.file_path.split(/[/\\]/).pop();
            return `✅ **Successfully wrote to [${fileName}](file://${params.file_path.replace(/\\/g, '/')})** (${params.content.length} characters)`;
        } catch (error) {
            return `Error writing to file: ${error}`;
        }
    }
};

// Tool: Fetch URL or web page content
export const webFetchTool: AgentTool = {
    name: "fetch_url",
    description: "Fetch and read text content from a web URL",
    parameters: {
        type: "object",
        properties: {
            url: {
                type: "string",
                description: "The HTTP or HTTPS URL to fetch"
            }
        },
        required: ["url"]
    },
    execute: async (params) => {
        try {
            let targetUrl = params.url.trim();
            if (!/^https?:\/\//i.test(targetUrl)) {
                targetUrl = 'https://' + targetUrl;
            }

            const res = await fetch(targetUrl);
            if (!res.ok) {
                return `Error fetching URL ${targetUrl}: HTTP ${res.status} ${res.statusText}`;
            }

            const html = await res.text();
            // Basic HTML to readable text extraction
            const cleanText = html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/\s+/g, ' ')
                .trim();

            const truncated = cleanText.length > 4000 ? cleanText.substring(0, 4000) + '...\n\n*(Truncated due to length)*' : cleanText;
            return `**Content fetched from ${targetUrl}:**\n\n${truncated}`;
        } catch (error) {
            return `Error fetching ${params.url}: ${error}`;
        }
    }
};

// Tool: DuckDuckGo Web Search
export const webSearchTool: AgentTool = {
    name: "web_search",
    description: "Search the web using DuckDuckGo search engine. Use this to find GitHub repositories, documentation, online answers, and web content.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The web search query (e.g. 'amanbig chatme github', 'react 19 release notes')"
            },
            max_results: {
                type: "number",
                description: "Number of search results to retrieve (default: 5)"
            }
        },
        required: ["query"]
    },
    execute: async (params) => {
        try {
            const results = await invoke('duckduckgo_search', {
                query: params.query,
                maxResults: params.max_results || 5
            }) as WebSearchResult[];

            if (!results || results.length === 0) {
                return `No web results found for "${params.query}".`;
            }

            let output = `**DuckDuckGo Search Results for "${params.query}":**\n\n`;
            for (const [i, res] of results.entries()) {
                output += `${i + 1}. **[${res.title}](${res.url})**\n   ${res.snippet}\n\n`;
            }
            return output.trim();
        } catch (error) {
            return `Web search error: ${error}`;
        }
    }
};

// Tool: Execute terminal command
export const executeCommandTool: AgentTool = {
    name: "execute_command",
    description: "Execute a shell command",
    parameters: {
        type: "object",
        properties: {
            command: {
                type: "string",
                description: "The shell command to execute"
            },
            working_directory: {
                type: "string",
                description: "Working directory (optional)"
            }
        },
        required: ["command"]
    },
    execute: async (params) => {
        try {
            const result = await invoke<any>('execute_command', {
                command: params.command,
                workingDirectory: params.working_directory || null,
                requestPermission: false
            });
            const output = [result.stdout, result.stderr].filter(Boolean).join('\n') || '(no output)';
            return `\`\`\`bash\n$ ${params.command}\n${output}\n\`\`\``;
        } catch (error) {
            return `Error executing command: ${error}`;
        }
    }
};

// Registry of all available tools
export const AGENT_TOOLS: Record<string, AgentTool> = {
    get_current_directory: getCurrentDirectoryTool,
    list_files: listFilesTool,
    search_files: searchFilesTool,
    read_file: readFileTool,
    read_document: readDocumentTool,
    write_file: writeFileTool,
    fetch_url: webFetchTool,
    web_search: webSearchTool,
    duckduckgo_search: webSearchTool,
    execute_command: executeCommandTool
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
    
    // Web / GitHub / Online search queries
    if (
        lowerQuery.includes('github') ||
        lowerQuery.includes('search web') ||
        lowerQuery.includes('search online') ||
        lowerQuery.includes('duckduckgo') ||
        lowerQuery.includes('google') ||
        lowerQuery.includes('search me docs') ||
        lowerQuery.includes('search docs') ||
        lowerQuery.includes('docs from') ||
        lowerQuery.includes('look up online') ||
        lowerQuery.includes('find on web')
    ) {
        let q = query.trim();
        const m = q.match(/(?:search(?:\s+me)?(?:\s+for)?|find|look up|get|show)\s+(?:the\s+)?(?:docs(?:\s+from|\s+for)?\s+)?["']?([^"']+)["']?/i);
        if (m && m[1]) {
            q = m[1].trim();
        }
        return {
            tool: webSearchTool,
            params: { query: q }
        };
    }

    // Local file search queries
    if ((lowerQuery.includes('search for') || lowerQuery.includes('grep')) && 
        (lowerQuery.includes('in file') || lowerQuery.includes('in directory') || lowerQuery.includes('in workspace') || lowerQuery.includes('in code') || lowerQuery.includes('grep '))) {
        
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

    // Web fetch queries
    const urlMatch = query.match(/https?:\/\/[^\s"'<>]+/i);
    if (urlMatch && (lowerQuery.includes('fetch') || lowerQuery.includes('read') || lowerQuery.includes('open') || lowerQuery.includes('summarize') || lowerQuery.includes('browse') || lowerQuery.includes('what is'))) {
        return {
            tool: webFetchTool,
            params: { url: urlMatch[0] }
        };
    }
    
    return null;
}
