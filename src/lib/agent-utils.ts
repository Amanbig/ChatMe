import { invoke } from '@tauri-apps/api/core';
import type { DirectoryContents, SearchResult } from './types';

// Global session ID for agent operations
let agentSessionId: string | null = null;

// Initialize or get agent session
async function ensureAgentSession(): Promise<string> {
    if (!agentSessionId) {
        // Generate a unique session ID
        agentSessionId = `agent-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        // Create or get the session in the backend
        await invoke('create_or_get_agent_session', { sessionId: agentSessionId });
    }
    return agentSessionId;
}

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
        // Ensure we have an agent session for commands that need it
        const sessionId = await ensureAgentSession();
        
        switch (command) {
            // File & Directory Operations
            case 'get_current_directory':
                return await invoke('get_current_directory');
            
            case 'change_directory':
                return await invoke('execute_agent_action', {
                    sessionId: sessionId,
                    actionType: 'change_directory',
                    parameters: { path: params.path }
                });
            
            case 'read_directory':
                return await invoke('read_directory', { 
                    directoryPath: params.directoryPath, 
                    recursive: params.recursive || false 
                });
            
            case 'read_file':
                return await invoke('read_file', { filePath: params.filePath });
            
            case 'write_file':
                return await invoke('write_file', { 
                    path: params.path, 
                    content: params.content 
                });
            
            case 'search_files':
                return await invoke('search_files', {
                    directoryPath: params.directoryPath,
                    pattern: params.pattern,
                    recursive: params.recursive || true,
                    maxResults: params.maxResults || 20
                });
            
            case 'open_file_with_default_app':
                return await invoke('open_file_with_default_app', { filePath: params.filePath });
            
            case 'file_operation':
                return await invoke('execute_agent_action', {
                    sessionId: sessionId,
                    actionType: 'file_operation',
                    parameters: {
                        operation_type: params.operation_type,
                        source: params.source,
                        destination: params.destination,
                        recursive: params.recursive || false
                    }
                });
            
            // Terminal & Command Execution
            case 'execute_command':
                // This may trigger permission dialog for dangerous commands
                return await invoke('execute_agent_action', {
                    sessionId: sessionId,
                    actionType: 'execute_command',
                    parameters: {
                        command: params.command,
                        working_directory: params.working_directory
                    }
                });
            
            // Application Management
            case 'launch_application':
                return await invoke('execute_agent_action', {
                    sessionId: sessionId,
                    actionType: 'launch_application',
                    parameters: {
                        path: params.path,
                        arguments: params.arguments || []
                    }
                });
            
            case 'get_installed_apps':
                return await invoke('execute_agent_action', {
                    sessionId: sessionId,
                    actionType: 'get_installed_apps',
                    parameters: {}
                });
            
            // Process Management
            case 'get_processes':
                return await invoke('execute_agent_action', {
                    sessionId: sessionId,
                    actionType: 'get_processes',
                    parameters: {}
                });
            
            case 'kill_process':
                // This will trigger permission dialog
                return await invoke('execute_agent_action', {
                    sessionId: sessionId,
                    actionType: 'kill_process',
                    parameters: { pid: params.pid }
                });
            
            default:
                throw new Error(`Unknown command: ${command}`);
        }
    } catch (error) {
        // Check if it's a permission denied error
        if (String(error).includes('permission') || String(error).includes('denied')) {
            throw new Error(`Permission denied for ${command}. User rejected the operation.`);
        }
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
            commands.push({ data: commandData, originalText: match[0] });
        } catch (e) {
            console.error('Failed to parse command:', match[1]);
        }
    }
    
    // Execute commands and replace with expandable components
    let processedResponse = response;
    
    for (const cmdInfo of commands) {
        const cmd = cmdInfo.data;
        let commandComponent = '';
        
        try {
            const result = await executeAgentCommand(cmd.command, cmd.params || {});
            
            // Create command execution component based on type
            if (cmd.command === 'execute_command') {
                // Get the actual command string
                const commandStr = cmd.params?.command || 'Unknown command';
                const workingDir = cmd.params?.working_directory;
                
                // Parse result if it's from AgentAction
                let actualResult = result;
                if (result && result.result) {
                    try {
                        actualResult = JSON.parse(result.result);
                    } catch {
                        actualResult = result.result;
                    }
                }
                
                const componentData = {
                    command: commandStr,
                    result: actualResult,
                    status: 'success',
                    type: 'command',
                    working_directory: workingDir
                };
                
                commandComponent = `<command-execution data='${JSON.stringify(componentData).replace(/'/g, "\\'")}'></command-execution>`;
                
            } else if (cmd.command === 'launch_application') {
                const appPath = cmd.params?.path || 'Unknown application';
                let resultMessage = 'Application launched';
                
                if (result && result.result) {
                    try {
                        const res = JSON.parse(result.result);
                        resultMessage = res.message || resultMessage;
                    } catch {
                        resultMessage = result.result || resultMessage;
                    }
                }
                
                const componentData = {
                    command: `launch ${appPath}`,
                    result: resultMessage,
                    status: 'success',
                    type: 'application'
                };
                
                commandComponent = `<command-execution data='${JSON.stringify(componentData).replace(/'/g, "\\'")}'></command-execution>`;
                
            } else if (cmd.command === 'file_operation') {
                const operation = cmd.params?.operation_type || 'operation';
                const source = cmd.params?.source || '';
                const dest = cmd.params?.destination || '';
                const commandStr = dest ? `${operation} ${source} → ${dest}` : `${operation} ${source}`;
                
                const componentData = {
                    command: commandStr,
                    result: result?.result || result,
                    status: 'success',
                    type: 'file_operation'
                };
                
                commandComponent = `<command-execution data='${JSON.stringify(componentData).replace(/'/g, "\\'")}'></command-execution>`;
                
            } else if (cmd.command === 'read_directory') {
                // Keep directory listing as special component
                commandComponent = formatDirectoryListing(result, cmd.params?.directoryPath || '');
                
            } else if (cmd.command === 'search_files') {
                commandComponent = formatSearchResults(result, cmd.params?.pattern || '');
                
            } else if (cmd.command === 'read_file') {
                // For file reading, show as code block
                commandComponent = `\n\`\`\`\n${result}\n\`\`\`\n`;
                
            } else if (cmd.command === 'get_processes') {
                let processes = result;
                if (result && result.result) {
                    try {
                        processes = JSON.parse(result.result);
                    } catch {
                        processes = result.result;
                    }
                }
                commandComponent = formatProcessList(processes);
                
            } else if (cmd.command === 'get_installed_apps') {
                let apps = result;
                if (result && result.result) {
                    try {
                        apps = JSON.parse(result.result);
                    } catch {
                        apps = result.result;
                    }
                }
                commandComponent = formatAppsList(apps);
                
            } else {
                // Default handling for other commands
                const componentData = {
                    command: cmd.command,
                    result: result?.result || result,
                    status: 'success',
                    type: 'general'
                };
                
                commandComponent = `<command-execution data='${JSON.stringify(componentData).replace(/'/g, "\\'")}'></command-execution>`;
            }
            
            // Replace the command with the component
            processedResponse = processedResponse.replace(cmdInfo.originalText, commandComponent);
            
        } catch (error) {
            // Create error component
            const componentData = {
                command: cmd.command,
                result: String(error),
                status: 'error',
                type: cmd.command
            };
            
            commandComponent = `<command-execution data='${JSON.stringify(componentData).replace(/'/g, "\\'")}'></command-execution>`;
            processedResponse = processedResponse.replace(cmdInfo.originalText, commandComponent);
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

// Format process list
function formatProcessList(processes: any[]): string {
    if (!processes || processes.length === 0) {
        return 'No processes found';
    }
    
    let formatted = `**Running Processes (${processes.length} total):**\n\n`;
    formatted += '| PID | Name | Memory | CPU |\n';
    formatted += '|-----|------|--------|-----|\n';
    
    // Show first 20 processes
    processes.slice(0, 20).forEach(proc => {
        const memory = proc.memory_usage ? `${(proc.memory_usage / 1024 / 1024).toFixed(1)} MB` : 'N/A';
        const cpu = proc.cpu_usage !== undefined ? `${proc.cpu_usage.toFixed(1)}%` : 'N/A';
        formatted += `| ${proc.pid} | ${proc.name} | ${memory} | ${cpu} |\n`;
    });
    
    if (processes.length > 20) {
        formatted += `\n*...and ${processes.length - 20} more processes*`;
    }
    
    return formatted;
}

// Format apps list
function formatAppsList(apps: any[]): string {
    if (!apps || apps.length === 0) {
        return 'No applications found';
    }
    
    let formatted = `**Installed Applications (${apps.length} found):**\n\n`;
    
    // Group by first letter for better organization
    const grouped = apps.reduce((acc, app) => {
        const firstLetter = app.name[0].toUpperCase();
        if (!acc[firstLetter]) acc[firstLetter] = [];
        acc[firstLetter].push(app);
        return acc;
    }, {} as Record<string, any[]>);
    
    Object.keys(grouped).sort().forEach(letter => {
        formatted += `**${letter}:**\n`;
        grouped[letter].forEach((app: any) => {
            formatted += `  📦 ${app.name}\n`;
        });
    });
    
    formatted += `\n*Use 'launch [app name]' to open any application*`;
    return formatted;
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
    
    return `You are now in AGENT MODE. You have access to powerful system capabilities to execute commands and perform operations.

**COMMAND EXECUTION SYNTAX:**
Use this format inline in your responses: [EXECUTE:{"command":"command_name","params":{"param1":"value1"}}]
Commands will be executed and results shown as expandable components in the chat.

**CURRENT WORKING DIRECTORY:** ${currentDir}

**AVAILABLE COMMANDS:**

**📁 FILE & DIRECTORY OPERATIONS:**

1. **get_current_directory** - Get current working directory
   Syntax: [EXECUTE:{"command":"get_current_directory"}]

2. **change_directory** - Change working directory
   Syntax: [EXECUTE:{"command":"change_directory","params":{"path":"C:\\\\Users\\\\Documents"}}]

3. **read_directory** - List files and folders
   Syntax: [EXECUTE:{"command":"read_directory","params":{"directoryPath":"${currentDir}","recursive":false}}]

4. **read_file** - Read file contents  
   Syntax: [EXECUTE:{"command":"read_file","params":{"filePath":"package.json"}}]

5. **write_file** - Write content to a file
   Syntax: [EXECUTE:{"command":"write_file","params":{"path":"output.txt","content":"Hello World"}}]

6. **search_files** - Search for text in files
   Syntax: [EXECUTE:{"command":"search_files","params":{"directoryPath":"${currentDir}","pattern":"function","recursive":true,"maxResults":20}}]

7. **open_file_with_default_app** - Open file/folder with default app
   Syntax: [EXECUTE:{"command":"open_file_with_default_app","params":{"filePath":"src/"}}]

8. **file_operation** - Copy/Move/Delete/Rename files and folders
   Syntax: [EXECUTE:{"command":"file_operation","params":{"operation_type":"copy","source":"file.txt","destination":"backup.txt"}}]
   Operations: copy, move, delete, create_directory, rename

**💻 TERMINAL & COMMAND EXECUTION:**

9. **execute_command** - Execute terminal/shell commands
   Syntax: [EXECUTE:{"command":"execute_command","params":{"command":"npm install","working_directory":"${currentDir}"}}]
   Note: Dangerous commands require user permission

**🚀 APPLICATION MANAGEMENT:**

10. **launch_application** - Launch applications
    Syntax: [EXECUTE:{"command":"launch_application","params":{"path":"C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe","arguments":["--new-window","https://google.com"]}}]

11. **get_installed_apps** - Get list of installed applications
    Syntax: [EXECUTE:{"command":"get_installed_apps"}]

**⚙️ PROCESS MANAGEMENT:**

12. **get_processes** - Get list of running processes
    Syntax: [EXECUTE:{"command":"get_processes"}]

13. **kill_process** - Terminate a process by PID
    Syntax: [EXECUTE:{"command":"kill_process","params":{"pid":1234}}]
    Note: Requires user permission

**EXAMPLE RESPONSES:**

User: "Run npm install"
Response: "I'll run npm install in the current directory.

[EXECUTE:{"command":"execute_command","params":{"command":"npm install","working_directory":"${currentDir}"}}]"

User: "Open Chrome browser"  
Response: "I'll launch Chrome for you.

[EXECUTE:{"command":"launch_application","params":{"path":"C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe"}}]"

User: "Copy this file to backup folder"
Response: "I'll copy the file to the backup folder.

[EXECUTE:{"command":"file_operation","params":{"operation_type":"copy","source":"file.txt","destination":"backup/file.txt","recursive":false}}]"

User: "Show running processes"
Response: "I'll get the list of running processes for you.

[EXECUTE:{"command":"get_processes"}]"

**IMPORTANT RULES:**
- You CAN execute terminal commands, launch applications, and perform system operations
- Always use the current working directory: ${currentDir}
- Use proper Windows path format with escaped backslashes in JSON: "\\\\"
- Always execute the appropriate command when users request operations
- Use the exact syntax with proper JSON formatting
- Always provide helpful context around the commands
- The commands will be automatically executed and replaced with results
- Dangerous operations (like killing processes or risky commands) require user permission
- Always be helpful and suggest what users can do next`;
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
