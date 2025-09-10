import { invoke } from '@tauri-apps/api/core';
import type { DirectoryContents, SearchResult } from './types';

// Function to open files/folders with default application
export async function openPath(path: string): Promise<string> {
    try {
        const result = await invoke('open_file_with_default_app', { filePath: path }) as string;
        return result;
    } catch (error) {
        throw new Error(`Failed to open ${path}: ${error}`);
    }
}

// Function to execute Tauri commands based on LLM instructions
export async function executeAgentCommand(command: string, params: any): Promise<any> {
    try {
        switch (command) {
            case 'get_current_directory':
                return await invoke('get_current_directory');
            
            case 'read_directory':
                return await invoke('read_directory', { 
                    directoryPath: params.directoryPath, 
                    recursive: params.recursive || false 
                });
            
            case 'read_file':
                return await invoke('read_file', { filePath: params.filePath });
            
            case 'search_files':
                return await invoke('search_files', {
                    directoryPath: params.directoryPath,
                    pattern: params.pattern,
                    recursive: params.recursive || true,
                    maxResults: params.maxResults || 20
                });
            
            case 'open_file_with_default_app':
                return await invoke('open_file_with_default_app', { filePath: params.filePath });
            
            default:
                throw new Error(`Unknown command: ${command}`);
        }
    } catch (error) {
        throw new Error(`Failed to execute ${command}: ${error}`);
    }
}

// Function to parse and execute commands from LLM responses
export async function parseAndExecuteCommands(response: string): Promise<string> {
    // Look for command patterns in the response
    const commandPattern = /\[EXECUTE:([^\]]+)\]/g;
    const commands = [];
    let match;
    
    while ((match = commandPattern.exec(response)) !== null) {
        try {
            const commandData = JSON.parse(match[1]);
            commands.push(commandData);
        } catch (e) {
            console.error('Failed to parse command:', match[1]);
        }
    }
    
    // Execute commands and replace with results
    let processedResponse = response;
    
    for (const cmd of commands) {
        try {
            const result = await executeAgentCommand(cmd.command, cmd.params || {});
            
            // Format the result based on command type
            let formattedResult = '';
            
            if (cmd.command === 'read_directory') {
                formattedResult = formatDirectoryListing(result, cmd.params?.directoryPath || '');
            } else if (cmd.command === 'search_files') {
                formattedResult = formatSearchResults(result, cmd.params?.pattern || '');
            } else if (cmd.command === 'read_file') {
                formattedResult = `\`\`\`\n${result}\n\`\`\``;
            } else {
                formattedResult = String(result);
            }
            
            // Replace the command with the result
            const commandText = `[EXECUTE:${JSON.stringify(cmd)}]`;
            processedResponse = processedResponse.replace(commandText, formattedResult);
            
        } catch (error) {
            const commandText = `[EXECUTE:${JSON.stringify(cmd)}]`;
            processedResponse = processedResponse.replace(commandText, `Error: ${error}`);
        }
    }
    
    return processedResponse;
}

// Format directory listing results
function formatDirectoryListing(result: DirectoryContents, basePath: string): string {
    // Create a special marker that the UI can detect and render as a component
    const fileListData = {
        type: 'file-list',
        directories: result.directories || [],
        files: result.files || [],
        basePath: basePath
    };
    
    return `<file-list-component data='${JSON.stringify(fileListData)}'></file-list-component>

**${result.directories?.length || 0} directories, ${result.files?.length || 0} files** found in \`${basePath}\`

You can ask me to open any specific file or folder by name!`;
}

// Format search results
function formatSearchResults(results: SearchResult[], pattern: string): string {
    if (!results || results.length === 0) {
        return `No results found for "${pattern}"`;
    }
    
    let formatted = `**Search results for "${pattern}" (${results.length} matches):**\n\n`;
    
    results.forEach(result => {
        const fileName = result.file_path.split(/[/\\]/).pop();
        formatted += `📄 **${fileName}** (Line ${result.line_number})\n`;
        formatted += `\`\`\`\n${result.line_content.trim()}\n\`\`\`\n\n`;
    });
    
    formatted += "*Ask me to 'open [filename]' to open any file with its default application.*";
    return formatted;
}

// Enhanced agent queries that get processed by LLM with available tools
export async function getAvailableAgentTools(): Promise<string> {
    // Get current directory to provide context
    let currentDir = '';
    try {
        currentDir = await invoke('get_current_directory') as string;
    } catch (error) {
        currentDir = 'Unable to determine current directory';
    }
    
    return `You are now in AGENT MODE. You can execute Tauri commands using the following syntax:

**COMMAND EXECUTION SYNTAX:**
Use this format to execute commands: [EXECUTE:{"command":"command_name","params":{"param1":"value1"}}]

**CURRENT WORKING DIRECTORY:** ${currentDir}

**AVAILABLE COMMANDS:**

1. **get_current_directory** - Get current working directory
   Syntax: [EXECUTE:{"command":"get_current_directory"}]

2. **read_directory** - List files and folders
   Syntax: [EXECUTE:{"command":"read_directory","params":{"directoryPath":"${currentDir}","recursive":false}}]

3. **read_file** - Read file contents  
   Syntax: [EXECUTE:{"command":"read_file","params":{"filePath":"package.json"}}]

4. **search_files** - Search for text in files
   Syntax: [EXECUTE:{"command":"search_files","params":{"directoryPath":"${currentDir}","pattern":"function","recursive":true,"maxResults":20}}]

5. **open_file_with_default_app** - Open file/folder with default app
   Syntax: [EXECUTE:{"command":"open_file_with_default_app","params":{"filePath":"src/"}}]

**EXAMPLE RESPONSES:**

User: "Show me the files in the current directory"
Response: "I'll list the files in the current directory for you.

[EXECUTE:{"command":"read_directory","params":{"directoryPath":"${currentDir}","recursive":false}}]"

User: "Open the src folder"  
Response: "I'll open the src folder for you.

[EXECUTE:{"command":"open_file_with_default_app","params":{"filePath":"${currentDir}\\\\src"}}]"

User: "Search for JavaScript files"
Response: "I'll search for JavaScript files in the current directory.

[EXECUTE:{"command":"search_files","params":{"directoryPath":"${currentDir}","pattern":".js","recursive":true,"maxResults":20}}]"

**IMPORTANT RULES:**
- Always use the current working directory: ${currentDir}
- Use proper Windows path format with escaped backslashes in JSON: "\\\\"
- Always execute the appropriate command when users request file operations
- Use the exact syntax with proper JSON formatting
- Always provide helpful context around the commands
- The commands will be automatically executed and replaced with results
- Always be helpful and suggest what users can do next
- When opening files/folders, use full paths relative to current directory`;
}

export async function handleAgentQuery(query: string, _workingDirectory: string): Promise<string | null> {
    // Return null to let LLM handle all agent queries with available tools
    // This function now serves as a fallback for very basic queries
    const lowerQuery = query.toLowerCase().trim();
    
    // Only handle very basic queries locally, let LLM handle complex ones with tools
    if (lowerQuery === 'pwd' || lowerQuery === 'current directory') {
        try {
            const result = await invoke('get_current_directory') as string;
            return `**Current working directory:**\n\`${result}\``;
        } catch (error) {
            return `Error getting current directory: ${error}`;
        }
    }
    
    // For all other queries, return null to let LLM handle with available Tauri commands
    return null;
}

// Function to create a structured response with file/folder information for the LLM
export function createFileListResponse(files: any[], directories: any[], basePath: string): string {
    let response = `**Files and folders in ${basePath}:**\n\n`;
    
    if (directories && directories.length > 0) {
        response += "**Directories:**\n";
        directories.forEach(dir => {
            response += `📁 ${dir.name}/\n`;
        });
        response += "\n";
    }
    
    if (files && files.length > 0) {
        response += "**Files:**\n";
        files.forEach(file => {
            response += `📄 ${file.name}\n`;
        });
        response += "\n";
    }
    
    response += "*Use 'open [filename]' or 'open [foldername]' to open items with default applications.*";
    return response;
}

// Function to create a search results response
export function createSearchResponse(results: any[], pattern: string): string {
    if (!results || results.length === 0) {
        return `No results found for "${pattern}"`;
    }
    
    let response = `**Search results for "${pattern}" (${results.length} matches):**\n\n`;
    
    results.forEach(result => {
        const fileName = result.file_path.split(/[/\\]/).pop();
        response += `📄 **${fileName}** (Line ${result.line_number})\n`;
        response += `\`\`\`\n${result.line_content.trim()}\n\`\`\`\n\n`;
    });
    
    response += "*Use 'open [filename]' to open any file with its default application.*";
    return response;
}

// Function to determine if agent mode should enhance the query with available tools
export function shouldUseAgentMode(isAgentActive: boolean): boolean {
    return isAgentActive;
}
