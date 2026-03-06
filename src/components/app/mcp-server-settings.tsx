import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
    FaServer,
    FaPlus,
    FaTrash,
    FaEdit,
    FaTimes,
    FaSave,
    FaSpinner,
    FaChevronDown,
    FaChevronRight,
    FaTerminal,
    FaGlobe,
    FaTools,
    FaCog
} from "react-icons/fa";
import {
    getMcpServers,
    createMcpServer,
    updateMcpServer,
    deleteMcpServer,
    getMcpToolsForServer,
    toggleMcpTool
} from "@/lib/api";
import type { McpServer, McpTool, McpTransportType, CreateMcpServerRequest, UpdateMcpServerRequest } from "@/lib/types";

interface McpServerWithToolsState extends McpServer {
    tools: McpTool[];
    loadingTools: boolean;
}

function ServerEditForm({
    server,
    onSave,
    onCancel,
    onDelete,
    saving
}: {
    server: McpServer;
    onSave: (data: UpdateMcpServerRequest) => void;
    onCancel: () => void;
    onDelete: () => void;
    saving: boolean;
}) {
    const [formData, setFormData] = useState<UpdateMcpServerRequest>({
        name: server.name,
        command: server.command,
        args: server.args,
        env: server.env,
        url: server.url,
        headers: server.headers,
        enabled: server.enabled,
        auto_connect: server.auto_connect,
        connection_timeout_ms: server.connection_timeout_ms,
    });

    const [argsText, setArgsText] = useState(server.args?.join(' ') || '');
    const [envText, setEnvText] = useState(
        server.env ? Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join('\n') : ''
    );

    const handleSave = () => {
        const args = argsText.trim() ? argsText.trim().split(/\s+/) : null;
        const env = envText.trim()
            ? Object.fromEntries(
                envText.trim().split('\n').map(line => {
                    const [key, ...rest] = line.split('=');
                    return [key.trim(), rest.join('=').trim()];
                })
            )
            : null;

        onSave({
            ...formData,
            args,
            env,
        });
    };

    return (
        <div className="p-5 rounded-xl border-2 border-primary/30 bg-primary/5 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white">
                    {server.transport_type === 'stdio' ? <FaTerminal size={18} /> : <FaGlobe size={18} />}
                </div>
                <div>
                    <h3 className="font-semibold">Edit MCP Server</h3>
                    <p className="text-xs text-muted-foreground">{server.transport_type.toUpperCase()} Transport</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-name">Server Name</Label>
                    <Input
                        id="edit-name"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="My MCP Server"
                    />
                </div>

                {server.transport_type === 'stdio' ? (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="edit-command">Command</Label>
                            <Input
                                id="edit-command"
                                value={formData.command || ''}
                                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                                placeholder="npx, python, node, etc."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-args">Arguments (space-separated)</Label>
                            <Input
                                id="edit-args"
                                value={argsText}
                                onChange={(e) => setArgsText(e.target.value)}
                                placeholder="-m mcp_server --port 8080"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-env">Environment Variables (KEY=value, one per line)</Label>
                            <textarea
                                id="edit-env"
                                value={envText}
                                onChange={(e) => setEnvText(e.target.value)}
                                placeholder="API_KEY=xxx&#10;DEBUG=true"
                                className="w-full h-20 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
                            />
                        </div>
                    </>
                ) : (
                    <div className="space-y-2">
                        <Label htmlFor="edit-url">Server URL</Label>
                        <Input
                            id="edit-url"
                            value={formData.url || ''}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            placeholder="http://localhost:8080/sse"
                        />
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={formData.enabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                        />
                        <Label className="text-sm cursor-pointer">Enabled</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={formData.auto_connect}
                            onCheckedChange={(checked) => setFormData({ ...formData, auto_connect: checked })}
                        />
                        <Label className="text-sm cursor-pointer">Auto-connect</Label>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCancel}
                        disabled={saving}
                        className="gap-1"
                    >
                        <FaTimes size={12} />
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={onDelete}
                        disabled={saving}
                        className="gap-1"
                    >
                        <FaTrash size={12} />
                        Delete
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="gap-1"
                    >
                        {saving ? <FaSpinner size={12} className="animate-spin" /> : <FaSave size={12} />}
                        Save
                    </Button>
                </div>
            </div>
        </div>
    );
}

function CreateServerForm({
    onSave,
    onCancel,
    saving
}: {
    onSave: (data: CreateMcpServerRequest) => void;
    onCancel: () => void;
    saving: boolean;
}) {
    const [transportType, setTransportType] = useState<McpTransportType>('stdio');
    const [formData, setFormData] = useState({
        name: '',
        command: '',
        url: '',
        enabled: true,
        auto_connect: true,
        connection_timeout_ms: 30000,
    });
    const [argsText, setArgsText] = useState('');
    const [envText, setEnvText] = useState('');

    const handleSave = () => {
        if (!formData.name.trim()) {
            toast.error('Please enter a server name');
            return;
        }

        if (transportType === 'stdio' && !formData.command.trim()) {
            toast.error('Please enter a command');
            return;
        }

        if (transportType === 'sse' && !formData.url.trim()) {
            toast.error('Please enter a URL');
            return;
        }

        const args = argsText.trim() ? argsText.trim().split(/\s+/) : undefined;
        const env = envText.trim()
            ? Object.fromEntries(
                envText.trim().split('\n').map(line => {
                    const [key, ...rest] = line.split('=');
                    return [key.trim(), rest.join('=').trim()];
                })
            )
            : undefined;

        onSave({
            name: formData.name,
            transport_type: transportType,
            command: transportType === 'stdio' ? formData.command : undefined,
            args: transportType === 'stdio' ? args : undefined,
            env: transportType === 'stdio' ? env : undefined,
            url: transportType === 'sse' ? formData.url : undefined,
            enabled: formData.enabled,
            auto_connect: formData.auto_connect,
            connection_timeout_ms: formData.connection_timeout_ms,
        });
    };

    return (
        <div className="p-5 rounded-xl border-2 border-green-500/30 bg-green-500/5 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
                    <FaPlus size={18} />
                </div>
                <div>
                    <h3 className="font-semibold">Add MCP Server</h3>
                    <p className="text-xs text-muted-foreground">Connect to an external tool provider</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="new-name">Server Name</Label>
                    <Input
                        id="new-name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="My MCP Server"
                    />
                </div>

                <div className="space-y-2">
                    <Label>Transport Type</Label>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant={transportType === 'stdio' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setTransportType('stdio')}
                            className="gap-2 flex-1"
                        >
                            <FaTerminal size={14} />
                            Stdio (Local)
                        </Button>
                        <Button
                            type="button"
                            variant={transportType === 'sse' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setTransportType('sse')}
                            className="gap-2 flex-1"
                        >
                            <FaGlobe size={14} />
                            SSE (Remote)
                        </Button>
                    </div>
                </div>

                {transportType === 'stdio' ? (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="new-command">Command</Label>
                            <Input
                                id="new-command"
                                value={formData.command}
                                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                                placeholder="npx, python, node, etc."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-args">Arguments (space-separated)</Label>
                            <Input
                                id="new-args"
                                value={argsText}
                                onChange={(e) => setArgsText(e.target.value)}
                                placeholder="-m mcp_server --port 8080"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-env">Environment Variables (KEY=value, one per line)</Label>
                            <textarea
                                id="new-env"
                                value={envText}
                                onChange={(e) => setEnvText(e.target.value)}
                                placeholder="API_KEY=xxx&#10;DEBUG=true"
                                className="w-full h-20 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none"
                            />
                        </div>
                    </>
                ) : (
                    <div className="space-y-2">
                        <Label htmlFor="new-url">Server URL</Label>
                        <Input
                            id="new-url"
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            placeholder="http://localhost:8080/sse"
                        />
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={formData.enabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                        />
                        <Label className="text-sm cursor-pointer">Enabled</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={formData.auto_connect}
                            onCheckedChange={(checked) => setFormData({ ...formData, auto_connect: checked })}
                        />
                        <Label className="text-sm cursor-pointer">Auto-connect</Label>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCancel}
                        disabled={saving}
                        className="gap-1"
                    >
                        <FaTimes size={12} />
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="gap-1 bg-green-600 hover:bg-green-700"
                    >
                        {saving ? <FaSpinner size={12} className="animate-spin" /> : <FaPlus size={12} />}
                        Create
                    </Button>
                </div>
            </div>
        </div>
    );
}

function ToolList({
    tools,
    onToggle
}: {
    tools: McpTool[];
    onToggle: (toolId: string, enabled: boolean) => void;
}) {
    if (tools.length === 0) {
        return (
            <div className="text-center py-4 text-sm text-muted-foreground">
                No tools discovered from this server yet.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {tools.map((tool) => (
                <div
                    key={tool.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <FaTools className="text-muted-foreground" size={14} />
                        <div>
                            <p className="text-sm font-medium">{tool.name}</p>
                            {tool.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">{tool.description}</p>
                            )}
                        </div>
                    </div>
                    <Switch
                        checked={tool.enabled}
                        onCheckedChange={(checked) => onToggle(tool.id, checked)}
                    />
                </div>
            ))}
        </div>
    );
}

export default function McpServerSettings() {
    const [servers, setServers] = useState<McpServerWithToolsState[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showAddNew, setShowAddNew] = useState(false);
    const [editingServerId, setEditingServerId] = useState<string | null>(null);
    const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    useEffect(() => {
        loadServers();
    }, []);

    useEffect(() => {
        if (deleteConfirmId) {
            const timer = setTimeout(() => {
                setDeleteConfirmId(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [deleteConfirmId]);

    const loadServers = async () => {
        try {
            setLoading(true);
            const fetchedServers = await getMcpServers();
            setServers(fetchedServers.map(s => ({ ...s, tools: [], loadingTools: false })));
        } catch (error) {
            console.error('Failed to load MCP servers:', error);
            toast.error('Failed to load MCP servers');
        } finally {
            setLoading(false);
        }
    };

    const loadToolsForServer = async (serverId: string) => {
        setServers(prev => prev.map(s =>
            s.id === serverId ? { ...s, loadingTools: true } : s
        ));

        try {
            const tools = await getMcpToolsForServer(serverId);
            setServers(prev => prev.map(s =>
                s.id === serverId ? { ...s, tools, loadingTools: false } : s
            ));
        } catch (error) {
            console.error('Failed to load tools:', error);
            setServers(prev => prev.map(s =>
                s.id === serverId ? { ...s, loadingTools: false } : s
            ));
        }
    };

    const handleToggleExpand = (serverId: string) => {
        setExpandedServers(prev => {
            const next = new Set(prev);
            if (next.has(serverId)) {
                next.delete(serverId);
            } else {
                next.add(serverId);
                // Load tools when expanding
                const server = servers.find(s => s.id === serverId);
                if (server && server.tools.length === 0) {
                    loadToolsForServer(serverId);
                }
            }
            return next;
        });
    };

    const handleCreate = async (data: CreateMcpServerRequest) => {
        try {
            setSaving(true);
            await createMcpServer(data);
            toast.success('MCP server added successfully');
            setShowAddNew(false);
            await loadServers();
        } catch (error) {
            console.error('Failed to create MCP server:', error);
            toast.error('Failed to create MCP server');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async (serverId: string, data: UpdateMcpServerRequest) => {
        try {
            setSaving(true);
            await updateMcpServer(serverId, data);
            toast.success('MCP server updated successfully');
            setEditingServerId(null);
            await loadServers();
        } catch (error) {
            console.error('Failed to update MCP server:', error);
            toast.error('Failed to update MCP server');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (serverId: string) => {
        try {
            await deleteMcpServer(serverId);
            toast.success('MCP server deleted successfully');
            setEditingServerId(null);
            await loadServers();
        } catch (error) {
            console.error('Failed to delete MCP server:', error);
            toast.error('Failed to delete MCP server');
        }
    };

    const handleToggleTool = async (toolId: string, enabled: boolean) => {
        try {
            await toggleMcpTool(toolId, enabled);
            setServers(prev => prev.map(s => ({
                ...s,
                tools: s.tools.map(t =>
                    t.id === toolId ? { ...t, enabled } : t
                )
            })));
        } catch (error) {
            console.error('Failed to toggle tool:', error);
            toast.error('Failed to toggle tool');
        }
    };

    return (
        <div className="space-y-6">
            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FaServer className="text-primary" />
                        MCP Servers
                    </CardTitle>
                    <CardDescription>
                        Connect to Model Context Protocol (MCP) servers to extend your AI's capabilities with external tools.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                            <p className="text-sm text-muted-foreground">Loading MCP servers...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {servers.length === 0 && !showAddNew && (
                                <div className="text-center py-12 px-4 border-2 border-dashed border-border/60 rounded-xl">
                                    <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                                        <FaServer size={20} className="text-muted-foreground/50" />
                                    </div>
                                    <h3 className="font-semibold text-foreground mb-1">No MCP servers configured</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Add an MCP server to extend your AI with external tools
                                    </p>
                                </div>
                            )}

                            {servers.map((server) => {
                                const isEditing = editingServerId === server.id;
                                const isExpanded = expandedServers.has(server.id);

                                if (isEditing) {
                                    return (
                                        <ServerEditForm
                                            key={server.id}
                                            server={server}
                                            onSave={(data) => handleUpdate(server.id, data)}
                                            onCancel={() => setEditingServerId(null)}
                                            onDelete={() => handleDelete(server.id)}
                                            saving={saving}
                                        />
                                    );
                                }

                                return (
                                    <Collapsible
                                        key={server.id}
                                        open={isExpanded}
                                        onOpenChange={() => handleToggleExpand(server.id)}
                                    >
                                        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                                            <div className="flex items-center justify-between p-4">
                                                <CollapsibleTrigger asChild>
                                                    <button className="flex items-center gap-4 flex-1 text-left">
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${server.enabled
                                                            ? 'bg-gradient-to-br from-purple-500 to-violet-600'
                                                            : 'bg-gradient-to-br from-gray-400 to-gray-500'
                                                            }`}>
                                                            {server.transport_type === 'stdio' ? <FaTerminal size={18} /> : <FaGlobe size={18} />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <h3 className="font-semibold flex items-center gap-2">
                                                                {server.name}
                                                                {!server.enabled && (
                                                                    <Badge variant="secondary" className="text-[10px]">Disabled</Badge>
                                                                )}
                                                            </h3>
                                                            <p className="text-sm text-muted-foreground">
                                                                {server.transport_type.toUpperCase()} • {server.transport_type === 'stdio' ? server.command : server.url}
                                                            </p>
                                                        </div>
                                                        {isExpanded ? (
                                                            <FaChevronDown className="text-muted-foreground" size={14} />
                                                        ) : (
                                                            <FaChevronRight className="text-muted-foreground" size={14} />
                                                        )}
                                                    </button>
                                                </CollapsibleTrigger>
                                                <div className="flex items-center gap-2 ml-4">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingServerId(server.id);
                                                        }}
                                                        className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary"
                                                    >
                                                        <FaEdit size={14} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (deleteConfirmId === server.id) {
                                                                handleDelete(server.id);
                                                                setDeleteConfirmId(null);
                                                            } else {
                                                                setDeleteConfirmId(server.id);
                                                            }
                                                        }}
                                                        className={`h-8 w-8 p-0 rounded-lg transition-all ${deleteConfirmId === server.id
                                                            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                                            : 'hover:bg-destructive/10 hover:text-destructive'
                                                            }`}
                                                    >
                                                        <FaTrash size={14} />
                                                    </Button>
                                                </div>
                                            </div>
                                            <CollapsibleContent>
                                                <div className="px-4 pb-4 pt-2 border-t border-border/40">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <FaTools className="text-primary" size={14} />
                                                        <h4 className="text-sm font-medium">Available Tools</h4>
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {server.tools.length}
                                                        </Badge>
                                                    </div>
                                                    {server.loadingTools ? (
                                                        <div className="flex items-center justify-center py-4 gap-2">
                                                            <FaSpinner className="animate-spin" size={14} />
                                                            <span className="text-sm text-muted-foreground">Loading tools...</span>
                                                        </div>
                                                    ) : (
                                                        <ToolList
                                                            tools={server.tools}
                                                            onToggle={handleToggleTool}
                                                        />
                                                    )}
                                                </div>
                                            </CollapsibleContent>
                                        </div>
                                    </Collapsible>
                                );
                            })}

                            {showAddNew ? (
                                <CreateServerForm
                                    onSave={handleCreate}
                                    onCancel={() => setShowAddNew(false)}
                                    saving={saving}
                                />
                            ) : (
                                <Button
                                    variant="outline"
                                    className="w-full gap-2 border-dashed"
                                    onClick={() => setShowAddNew(true)}
                                >
                                    <FaPlus size={14} />
                                    Add MCP Server
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="border-border/60">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FaCog className="text-primary" />
                        About MCP
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-3">
                    <p>
                        The <strong>Model Context Protocol (MCP)</strong> is an open standard that allows AI assistants
                        to securely connect to external tools and data sources.
                    </p>
                    <p>
                        <strong>Stdio transport</strong> runs a local process and communicates via stdin/stdout.
                        This is ideal for tools installed on your machine.
                    </p>
                    <p>
                        <strong>SSE transport</strong> connects to a remote server via Server-Sent Events.
                        This is useful for cloud-hosted tools or shared services.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
