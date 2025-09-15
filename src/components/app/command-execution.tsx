import { useState } from "react";
import { ChevronDown, ChevronRight, Terminal, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

interface CommandExecutionProps {
    command: string;
    result?: any;
    status: "pending" | "running" | "success" | "error";
    type?: string;
    working_directory?: string;
}

export default function CommandExecution({ 
    command, 
    result, 
    status, 
    type = "command",
    working_directory 
}: CommandExecutionProps) {
    const [isExpanded, setIsExpanded] = useState(status === "error");

    const getStatusIcon = () => {
        switch (status) {
            case "pending":
                return <AlertCircle className="h-4 w-4 text-yellow-500 animate-pulse" />;
            case "running":
                return <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
            case "success":
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case "error":
                return <XCircle className="h-4 w-4 text-red-500" />;
        }
    };

    const getStatusText = () => {
        switch (status) {
            case "pending":
                return "Pending execution...";
            case "running":
                return "Running...";
            case "success":
                return "Executed successfully";
            case "error":
                return "Execution failed";
        }
    };

    const formatResult = () => {
        if (!result) return null;

        // Handle different types of results
        if (type === "command" && result.stdout !== undefined) {
            return (
                <div className="space-y-2">
                    {result.stdout && (
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Output:</div>
                            <pre className="bg-black/5 dark:bg-white/5 p-3 rounded text-xs overflow-x-auto">
                                {result.stdout}
                            </pre>
                        </div>
                    )}
                    {result.stderr && (
                        <div>
                            <div className="text-xs text-red-500 mb-1">Errors:</div>
                            <pre className="bg-red-50 dark:bg-red-950 p-3 rounded text-xs overflow-x-auto text-red-600 dark:text-red-400">
                                {result.stderr}
                            </pre>
                        </div>
                    )}
                    {result.exit_code !== undefined && result.exit_code !== 0 && (
                        <div className="text-xs text-muted-foreground">
                            Exit code: {result.exit_code}
                        </div>
                    )}
                </div>
            );
        } else if (typeof result === "string") {
            return (
                <pre className="bg-black/5 dark:bg-white/5 p-3 rounded text-xs overflow-x-auto">
                    {result}
                </pre>
            );
        } else if (typeof result === "object") {
            return (
                <pre className="bg-black/5 dark:bg-white/5 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(result, null, 2)}
                </pre>
            );
        }
        
        return null;
    };

    return (
        <div className={cn(
            "my-2 border rounded-lg overflow-hidden",
            status === "error" ? "border-red-200 dark:border-red-800" : "border-border"
        )}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                    "w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/50 transition-colors text-left",
                    status === "error" ? "bg-red-50 dark:bg-red-950/30" : "bg-muted/30"
                )}
            >
                <div className="flex-shrink-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
                <Terminal className="h-4 w-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <code className="text-xs font-mono truncate block">{command}</code>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {getStatusIcon()}
                    <span className="text-xs text-muted-foreground">{getStatusText()}</span>
                </div>
            </button>
            
            {isExpanded && (
                <div className="px-3 py-2 border-t bg-background">
                    {working_directory && (
                        <div className="text-xs text-muted-foreground mb-2">
                            Working directory: <code>{working_directory}</code>
                        </div>
                    )}
                    {status === "pending" && (
                        <div className="text-xs text-muted-foreground">
                            Waiting to execute...
                        </div>
                    )}
                    {status === "running" && (
                        <div className="text-xs text-muted-foreground">
                            Executing command...
                        </div>
                    )}
                    {(status === "success" || status === "error") && formatResult()}
                </div>
            )}
        </div>
    );
}
