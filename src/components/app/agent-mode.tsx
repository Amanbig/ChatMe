import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { toast } from "sonner";
import { 
    FaRobot, 
    FaPlay, 
    FaStop, 
    FaCode, 
    FaFolderOpen, 
    FaSearch, 
    FaFile,
    FaEdit,
    FaExternalLinkAlt,
    FaHistory
} from "react-icons/fa";
import {
    createOrGetAgentSession,
    getAgentCapabilities,
    executeAgentAction,
    getAgentSession
} from "../../lib/api";
import type { AgentSession, AgentCapability, AgentAction } from "../../lib/types";

interface AgentModeProps {
    chatId: string;
    onSendMessage?: (message: string) => void;
}

export default function AgentMode({ chatId, onSendMessage }: AgentModeProps) {
    const [agentActive, setAgentActive] = useState(false);
    const [session, setSession] = useState<AgentSession | null>(null);
    const [capabilities, setCapabilities] = useState<AgentCapability[]>([]);
    const [selectedAction, setSelectedAction] = useState<string>("");
    const [actionParameters, setActionParameters] = useState<Record<string, any>>({});
    const [isExecuting, setIsExecuting] = useState(false);
    const [actionHistory, setActionHistory] = useState<AgentAction[]>([]);

    useEffect(() => {
        loadCapabilities();
    }, []);

    useEffect(() => {
        if (agentActive && !session) {
            initializeSession();
        }
    }, [agentActive, session]);

    const loadCapabilities = async () => {
        try {
            const caps = await getAgentCapabilities();
            setCapabilities(caps);
        } catch (error) {
            console.error('Failed to load agent capabilities:', error);
            toast.error('Failed to load agent capabilities');
        }
    };

    const initializeSession = async () => {
        try {
            const newSession = await createOrGetAgentSession(chatId);
            setSession(newSession);
            setActionHistory(newSession.actions);
        } catch (error) {
            console.error('Failed to initialize agent session:', error);
            toast.error('Failed to initialize agent session');
            setAgentActive(false);
        }
    };

    const refreshSession = async () => {
        if (!session) return;
        
        try {
            const updatedSession = await getAgentSession(session.id);
            setSession(updatedSession);
            setActionHistory(updatedSession.actions);
        } catch (error) {
            console.error('Failed to refresh session:', error);
        }
    };

    const executeAction = async () => {
        if (!session || !selectedAction) return;

        setIsExecuting(true);
        try {
            const result = await executeAgentAction(session.id, selectedAction, actionParameters);
            
            if (result.success) {
                toast.success(`Successfully executed ${selectedAction}`);
                
                // Send result to chat if requested
                if (onSendMessage) {
                    const resultText = typeof result.result === 'string' 
                        ? result.result 
                        : JSON.stringify(result.result, null, 2);
                    
                    onSendMessage(`🤖 Agent Action: ${selectedAction}\n\nResult:\n${resultText}`);
                }
            } else {
                toast.error(`Failed to execute ${selectedAction}: ${result.error_message}`);
            }
            
            await refreshSession();
            
            // Reset form
            setSelectedAction("");
            setActionParameters({});
        } catch (error) {
            console.error('Failed to execute action:', error);
            toast.error('Failed to execute agent action');
        } finally {
            setIsExecuting(false);
        }
    };

    const handleParameterChange = (paramName: string, value: any) => {
        setActionParameters(prev => ({
            ...prev,
            [paramName]: value
        }));
    };

    const handleActionSelect = (actionName: string) => {
        setSelectedAction(actionName);
        
        // Initialize parameters with default values
        const capability = capabilities.find(cap => cap.name === actionName);
        if (capability) {
            const defaultParams: Record<string, any> = {};
            capability.parameters.forEach(param => {
                if (param.default_value !== undefined) {
                    defaultParams[param.name] = param.default_value;
                }
            });
            setActionParameters(defaultParams);
        }
    };

    const renderParameterInput = (_capability: AgentCapability, param: any) => {
        const value = actionParameters[param.name] ?? param.default_value ?? '';
        
        switch (param.parameter_type) {
            case 'boolean':
                return (
                    <div className="flex items-center space-x-2">
                        <Switch
                            id={param.name}
                            checked={value}
                            onCheckedChange={(checked) => handleParameterChange(param.name, checked)}
                        />
                        <Label htmlFor={param.name}>{param.description}</Label>
                    </div>
                );
            
            case 'number':
                return (
                    <div className="space-y-2">
                        <Label htmlFor={param.name}>
                            {param.name} {param.required && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                            id={param.name}
                            type="number"
                            value={value}
                            onChange={(e) => handleParameterChange(param.name, parseFloat(e.target.value))}
                            placeholder={param.description}
                        />
                    </div>
                );
            
            default:
                return (
                    <div className="space-y-2">
                        <Label htmlFor={param.name}>
                            {param.name} {param.required && <span className="text-red-500">*</span>}
                        </Label>
                        {param.name === 'content' ? (
                            <Textarea
                                id={param.name}
                                value={value}
                                onChange={(e) => handleParameterChange(param.name, e.target.value)}
                                placeholder={param.description}
                                rows={4}
                            />
                        ) : (
                            <Input
                                id={param.name}
                                value={value}
                                onChange={(e) => handleParameterChange(param.name, e.target.value)}
                                placeholder={param.description}
                            />
                        )}
                    </div>
                );
        }
    };

    const getActionIcon = (actionType: string) => {
        switch (actionType) {
            case 'list_directory':
                return <FaFolderOpen className="h-4 w-4" />;
            case 'read_file':
                return <FaFile className="h-4 w-4" />;
            case 'write_file':
                return <FaEdit className="h-4 w-4" />;
            case 'search_files':
                return <FaSearch className="h-4 w-4" />;
            case 'open_file':
                return <FaExternalLinkAlt className="h-4 w-4" />;
            default:
                return <FaCode className="h-4 w-4" />;
        }
    };

    const selectedCapability = capabilities.find(cap => cap.name === selectedAction);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FaRobot className="h-5 w-5" />
                    Agentic Mode
                    <Badge variant={agentActive ? "default" : "secondary"}>
                        {agentActive ? "Active" : "Inactive"}
                    </Badge>
                </CardTitle>
                <CardDescription>
                    Enable AI agent capabilities for file operations and system interactions
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[600px] p-6">
                    <div className="space-y-6">
                        {/* Agent Toggle */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="agent-active">Enable Agent Mode</Label>
                                <div className="text-sm text-muted-foreground">
                                    Allow AI to perform file operations and system tasks
                                </div>
                            </div>
                            <Switch
                        id="agent-active"
                        checked={agentActive}
                        onCheckedChange={setAgentActive}
                    />
                </div>

                {agentActive && session && (
                    <div className="space-y-6">
                        {/* Session Info */}
                        <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-sm font-medium">Agent Session Active</div>
                            <div className="text-xs text-muted-foreground">
                                Working Directory: {session.current_directory}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Actions Executed: {session.actions.length}
                            </div>
                        </div>

                        {/* Action Selection */}
                        <div className="space-y-3">
                            <Label>Select Action</Label>
                            <Select value={selectedAction} onValueChange={handleActionSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose an action to execute" />
                                </SelectTrigger>
                                <SelectContent>
                                    {capabilities.map((capability) => (
                                        <SelectItem key={capability.name} value={capability.name}>
                                            <div className="flex items-center gap-2">
                                                {getActionIcon(capability.name)}
                                                <div>
                                                    <div className="font-medium">{capability.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {capability.description}
                                                    </div>
                                                </div>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Action Parameters */}
                        {selectedCapability && (
                            <div className="space-y-4">
                                <div className="text-sm font-medium">Parameters</div>
                                {selectedCapability.parameters.map((param) => (
                                    <div key={param.name}>
                                        {renderParameterInput(selectedCapability, param)}
                                    </div>
                                ))}
                                
                                <Button
                                    onClick={executeAction}
                                    disabled={isExecuting || !selectedAction}
                                    className="w-full"
                                >
                                    {isExecuting ? (
                                        <>
                                            <FaStop className="mr-2 h-4 w-4 animate-spin" />
                                            Executing...
                                        </>
                                    ) : (
                                        <>
                                            <FaPlay className="mr-2 h-4 w-4" />
                                            Execute Action
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Action History */}
                        {actionHistory.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <FaHistory className="h-4 w-4" />
                                    <Label>Recent Actions</Label>
                                </div>
                                <ScrollArea className="h-48 w-full border rounded-md p-3">
                                    <div className="space-y-2">
                                        {actionHistory.slice(-10).reverse().map((action, index) => (
                                            <div
                                                key={index}
                                                className={`p-2 rounded-lg text-sm ${
                                                    action.success 
                                                        ? 'bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800' 
                                                        : 'bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 font-medium">
                                                    {getActionIcon(action.action_type)}
                                                    {action.action_type}
                                                    <Badge variant={action.success ? "default" : "destructive"} className="h-5">
                                                        {action.success ? "Success" : "Failed"}
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {action.description}
                                                </div>
                                                {action.error_message && (
                                                    <div className="text-xs text-red-600 mt-1">
                                                        Error: {action.error_message}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        )}
                    </div>
                )}
                </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
