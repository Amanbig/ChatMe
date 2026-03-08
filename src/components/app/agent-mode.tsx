import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { toast } from "sonner";
import {
    FaRobot,
    FaFolder,
    FaTerminal,
    FaRocket,
    FaShieldAlt,
    FaBrain,
    FaCheck,
    FaFileAlt,
    FaDesktop
} from "react-icons/fa";
import { useAgent } from "../../contexts/AgentContext";

const capabilities = [
    {
        id: "overview",
        icon: <FaBrain className="h-5 w-5 text-primary" />,
        title: "How Agent Mode Works",
        description: "When enabled, simply chat with natural language requests and the AI will automatically understand your intent and perform actions.",
        examples: [
            "Open Chrome browser",
            "Run npm install in current directory",
            "List all running processes",
            "Create a new folder called 'test'"
        ]
    },
    {
        id: "file-ops",
        icon: <FaFileAlt className="h-5 w-5 text-blue-500" />,
        title: "File Operations",
        badge: "Enhanced",
        description: "Manage files and directories through natural language commands.",
        features: [
            "Copy, move, rename, delete files/folders",
            "Create new directories",
            "Search files with patterns",
            "Read and write file contents",
            "Open files with default apps"
        ]
    },
    {
        id: "terminal",
        icon: <FaTerminal className="h-5 w-5 text-yellow-500" />,
        title: "Terminal Commands",
        badge: "Permission Required",
        description: "Execute terminal and shell commands with user permission.",
        features: [
            "Run build scripts and automation",
            "Install packages (npm, pip, etc.)",
            "Git operations and version control",
            "System administration tasks"
        ]
    },
    {
        id: "apps",
        icon: <FaRocket className="h-5 w-5 text-purple-500" />,
        title: "Application Control",
        description: "Launch and manage applications on your system.",
        features: [
            "Launch installed applications",
            "List all installed apps",
            "Pass arguments to programs",
            "View running processes"
        ]
    },
    {
        id: "processes",
        icon: <FaDesktop className="h-5 w-5 text-red-500" />,
        title: "Process Management",
        badge: "Advanced",
        description: "Monitor and manage system processes.",
        features: [
            "View all running processes",
            "Monitor CPU and memory usage",
            "Terminate specific processes",
            "Manage system resources"
        ]
    }
];

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
        <div className="space-y-6">
            {/* Main Toggle Card */}
            <Card className="border-border/60">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300 ${isAgentActive
                                    ? 'bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20'
                                    : 'bg-muted'
                                }`}>
                                <FaRobot className={`h-6 w-6 transition-colors duration-300 ${isAgentActive ? 'text-primary-foreground' : 'text-muted-foreground'
                                    }`} />
                            </div>
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    Agent Mode
                                    {isAgentActive && (
                                        <Badge className="bg-green-500 text-white gap-1">
                                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                            Active
                                        </Badge>
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    Enable autonomous AI agent for intelligent task execution
                                </CardDescription>
                            </div>
                        </div>
                        <Switch
                            checked={isAgentActive}
                            onCheckedChange={handleAgentToggle}
                            className="scale-125"
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Working Directory */}
                    <div className={`p-4 rounded-xl border transition-all duration-300 ${isAgentActive
                            ? 'bg-primary/5 border-primary/20'
                            : 'bg-muted/30 border-border/50'
                        }`}>
                        <Label htmlFor="working-directory" className="flex items-center gap-2 mb-3">
                            <FaFolder className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Working Directory</span>
                        </Label>
                        <Input
                            id="working-directory"
                            placeholder="Enter working directory path (e.g., C:\projects\myapp)"
                            value={workingDirectory}
                            onChange={(e) => handleWorkingDirectoryChange(e.target.value)}
                            disabled={!isAgentActive}
                            className="bg-background"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                            The base directory where the agent will perform file operations
                        </p>
                    </div>

                    {/* Security Notice */}
                    <div className="p-4 rounded-xl border-2 border-yellow-500/20 bg-yellow-500/5 flex items-start gap-3">
                        <FaShieldAlt className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                        <div>
                            <h4 className="font-medium text-sm">Security First</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                                All potentially dangerous operations require your explicit permission.
                                The agent will never execute harmful commands without your approval.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Capabilities Grid - Only show when active */}
            {isAgentActive && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom-4 duration-300">
                    {capabilities.map((cap) => (
                        <Card key={cap.id} className="border-border/60 hover:border-primary/30 transition-colors">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                            {cap.icon}
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">{cap.title}</CardTitle>
                                            {cap.badge && (
                                                <Badge variant={cap.id === 'processes' ? 'destructive' : 'secondary'} className="text-[10px] mt-1">
                                                    {cap.badge}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <p className="text-sm text-muted-foreground mb-3">
                                    {cap.description}
                                </p>
                                {cap.examples ? (
                                    <div className="space-y-1.5">
                                        <p className="text-xs font-medium text-foreground">Quick Examples:</p>
                                        {cap.examples.map((example, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="w-1 h-1 rounded-full bg-primary/60" />
                                                {example}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {cap.features?.map((feature, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <FaCheck className="h-3 w-3 text-green-500" />
                                                {feature}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Inactive State */}
            {!isAgentActive && (
                <Card className="border-dashed border-border/60 bg-muted/30">
                    <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                            <FaRobot className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <h3 className="font-semibold text-foreground mb-2">Agent Mode is Disabled</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                            Enable Agent Mode to unlock autonomous AI capabilities including file operations,
                            terminal commands, and application control.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
