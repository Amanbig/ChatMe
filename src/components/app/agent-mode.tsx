import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Switch } from "../ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { toast } from "sonner";
import { FaRobot, FaFolder, FaTerminal, FaRocket, FaCog, FaChevronDown, FaShieldAlt } from "react-icons/fa";
import { useAgent } from "../../contexts/AgentContext";
import { useState } from "react";

export default function AgentMode() {
    const { isAgentActive, workingDirectory, setAgentActive, setWorkingDirectory } = useAgent();
    const [expandedSections, setExpandedSections] = useState<string[]>(["overview"]);

    const handleWorkingDirectoryChange = (newPath: string) => {
        setWorkingDirectory(newPath);
        if (isAgentActive && newPath.trim()) {
            toast.info(`Working directory will be updated to: ${newPath}`);
        }
    };

    const handleAgentToggle = (enabled: boolean) => {
        setAgentActive(enabled);
        toast.info(enabled ? "Agent mode enabled" : "Agent mode disabled");
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FaRobot className="h-5 w-5" />
                    Agent Mode
                    {isAgentActive && <Badge variant="default">Active</Badge>}
                </CardTitle>
                <CardDescription>
                    Enable autonomous AI agent functionality for intelligent task execution
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[400px] w-full">
                    <div className="space-y-6">
                        {/* Enable/Disable Toggle */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Enable Agent Mode</Label>
                                <div className="text-sm text-muted-foreground">
                                    Turn on autonomous AI agent functionality
                                </div>
                            </div>
                            <Switch
                                checked={isAgentActive}
                                onCheckedChange={handleAgentToggle}
                            />
                        </div>

                        {/* Working Directory */}
                        <div className="space-y-2">
                            <Label htmlFor="working-directory" className="flex items-center gap-2">
                                <FaFolder className="h-4 w-4" />
                                Working Directory
                            </Label>
                            <Input
                                id="working-directory"
                                placeholder="Enter working directory path (e.g., C:\\projects\\myapp)"
                                value={workingDirectory}
                                onChange={(e) => handleWorkingDirectoryChange(e.target.value)}
                                disabled={!isAgentActive}
                            />
                            <div className="text-sm text-muted-foreground">
                                Set the base directory where the agent will operate
                            </div>
                        </div>

                        {/* Capabilities Overview */}
                        {isAgentActive && (
                            <div className="space-y-3">
                                {/* Overview Section */}
                                <Collapsible
                                    open={expandedSections.includes("overview")}
                                    onOpenChange={(open) => {
                                        setExpandedSections(open 
                                            ? [...expandedSections, "overview"]
                                            : expandedSections.filter(s => s !== "overview")
                                        );
                                    }}
                                >
                                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <FaRobot className="h-4 w-4" />
                                            <span className="font-medium">How Agent Mode Works</span>
                                        </div>
                                        <FaChevronDown className={`h-4 w-4 transition-transform ${
                                            expandedSections.includes("overview") ? "rotate-180" : ""
                                        }`} />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="p-4 border rounded-lg bg-muted/50 mt-2">
                                            <div className="text-sm text-muted-foreground space-y-2">
                                                <div>When agent mode is enabled, simply chat with natural language requests. The AI will automatically understand your intent and perform the appropriate actions.</div>
                                                
                                                <div className="mt-3">
                                                    <div className="font-medium mb-1">Quick Examples:</div>
                                                    <div className="grid grid-cols-1 gap-1">
                                                        <div>• "Open Chrome browser"</div>
                                                        <div>• "Run npm install in current directory"</div>
                                                        <div>• "List all running processes"</div>
                                                        <div>• "Create a new folder called 'test'"</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>

                                {/* File Operations */}
                                <Collapsible
                                    open={expandedSections.includes("file-ops")}
                                    onOpenChange={(open) => {
                                        setExpandedSections(open 
                                            ? [...expandedSections, "file-ops"]
                                            : expandedSections.filter(s => s !== "file-ops")
                                        );
                                    }}
                                >
                                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <FaFolder className="h-4 w-4" />
                                            <span className="font-medium">File & Directory Operations</span>
                                        </div>
                                        <FaChevronDown className={`h-4 w-4 transition-transform ${
                                            expandedSections.includes("file-ops") ? "rotate-180" : ""
                                        }`} />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="p-4 border rounded-lg bg-muted/50 mt-2">
                                            <div className="text-sm space-y-3">
                                                <div>
                                                    <Badge className="mb-2">Enhanced File Explorer</Badge>
                                                    <div className="text-muted-foreground">
                                                        • Copy, move, rename, and delete files/folders<br />
                                                        • Create new directories<br />
                                                        • Search files with regex patterns<br />
                                                        • Read and write file contents<br />
                                                        • Open files with default applications
                                                    </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground italic">
                                                    Example: "Copy all .js files to backup folder"
                                                </div>
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>

                                {/* Terminal Commands */}
                                <Collapsible
                                    open={expandedSections.includes("terminal")}
                                    onOpenChange={(open) => {
                                        setExpandedSections(open 
                                            ? [...expandedSections, "terminal"]
                                            : expandedSections.filter(s => s !== "terminal")
                                        );
                                    }}
                                >
                                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <FaTerminal className="h-4 w-4" />
                                            <span className="font-medium">Terminal Command Execution</span>
                                            <Badge variant="outline" className="text-xs">With Permission</Badge>
                                        </div>
                                        <FaChevronDown className={`h-4 w-4 transition-transform ${
                                            expandedSections.includes("terminal") ? "rotate-180" : ""
                                        }`} />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="p-4 border rounded-lg bg-muted/50 mt-2">
                                            <div className="text-sm space-y-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <FaShieldAlt className="h-4 w-4 text-yellow-500" />
                                                        <Badge variant="outline" className="text-yellow-600">Permission Required</Badge>
                                                    </div>
                                                    <div className="text-muted-foreground">
                                                        • Execute terminal/shell commands<br />
                                                        • Run build scripts and automation<br />
                                                        • Install packages and dependencies<br />
                                                        • Git operations and version control<br />
                                                        • System administration tasks
                                                    </div>
                                                </div>
                                                <div className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded text-xs">
                                                    ⚠️ Dangerous commands are blocked for safety
                                                </div>
                                                <div className="text-xs text-muted-foreground italic">
                                                    Example: "Run npm test in the project folder"
                                                </div>
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>

                                {/* Application Control */}
                                <Collapsible
                                    open={expandedSections.includes("apps")}
                                    onOpenChange={(open) => {
                                        setExpandedSections(open 
                                            ? [...expandedSections, "apps"]
                                            : expandedSections.filter(s => s !== "apps")
                                        );
                                    }}
                                >
                                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <FaRocket className="h-4 w-4" />
                                            <span className="font-medium">Application Control</span>
                                        </div>
                                        <FaChevronDown className={`h-4 w-4 transition-transform ${
                                            expandedSections.includes("apps") ? "rotate-180" : ""
                                        }`} />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="p-4 border rounded-lg bg-muted/50 mt-2">
                                            <div className="text-sm space-y-3">
                                                <div>
                                                    <Badge className="mb-2">Launch & Manage Apps</Badge>
                                                    <div className="text-muted-foreground">
                                                        • Launch installed applications<br />
                                                        • List all installed apps<br />
                                                        • Pass arguments to applications<br />
                                                        • View running processes<br />
                                                        • Terminate processes (with permission)
                                                    </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground italic">
                                                    Example: "Open Visual Studio Code with the current folder"
                                                </div>
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>

                                {/* Process Management */}
                                <Collapsible
                                    open={expandedSections.includes("processes")}
                                    onOpenChange={(open) => {
                                        setExpandedSections(open 
                                            ? [...expandedSections, "processes"]
                                            : expandedSections.filter(s => s !== "processes")
                                        );
                                    }}
                                >
                                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <FaCog className="h-4 w-4" />
                                            <span className="font-medium">Process Management</span>
                                            <Badge variant="destructive" className="text-xs">Advanced</Badge>
                                        </div>
                                        <FaChevronDown className={`h-4 w-4 transition-transform ${
                                            expandedSections.includes("processes") ? "rotate-180" : ""
                                        }`} />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="p-4 border rounded-lg bg-muted/50 mt-2">
                                            <div className="text-sm space-y-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <FaShieldAlt className="h-4 w-4 text-red-500" />
                                                        <Badge variant="destructive">High Permission Required</Badge>
                                                    </div>
                                                    <div className="text-muted-foreground">
                                                        • View all running processes<br />
                                                        • Monitor CPU and memory usage<br />
                                                        • Terminate specific processes by PID<br />
                                                        • Manage system resources
                                                    </div>
                                                </div>
                                                <div className="p-2 bg-red-50 dark:bg-red-950 rounded text-xs">
                                                    🔒 Requires explicit user permission for each action
                                                </div>
                                                <div className="text-xs text-muted-foreground italic">
                                                    Example: "Show me all Chrome processes"
                                                </div>
                                            </div>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>

                                {/* Security Notice */}
                                <div className="p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
                                    <div className="flex items-start gap-2">
                                        <FaShieldAlt className="h-5 w-5 text-primary mt-0.5" />
                                        <div className="space-y-1">
                                            <h4 className="font-medium">Security First</h4>
                                            <p className="text-sm text-muted-foreground">
                                                All potentially dangerous operations require your explicit permission. 
                                                The agent will never execute harmful commands without your approval.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
