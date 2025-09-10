import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Switch } from "../ui/switch";
import { toast } from "sonner";
import { FaRobot, FaFolder } from "react-icons/fa";
import { useAgent } from "../../contexts/AgentContext";

export default function AgentMode() {
    const { isAgentActive, workingDirectory, setAgentActive, setWorkingDirectory } = useAgent();

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

                        {/* Instructions */}
                        {isAgentActive && (
                            <div className="space-y-3">
                                <div className="p-4 border rounded-lg bg-muted/50">
                                    <h4 className="font-medium mb-2">How Agent Mode Works</h4>
                                    <div className="text-sm text-muted-foreground space-y-2">
                                        <div>When agent mode is enabled, simply chat with natural language requests. The AI will automatically understand your intent and perform the appropriate actions.</div>
                                        
                                        <div className="mt-3">
                                            <div className="font-medium mb-1">Example requests:</div>
                                            <div>• "Search for function getName in all JavaScript files"</div>
                                            <div>• "List all files in the src directory"</div>
                                            <div>• "Find all TODO comments in the project"</div>
                                            <div>The agent will automatically determine and execute the appropriate actions.</div>
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
