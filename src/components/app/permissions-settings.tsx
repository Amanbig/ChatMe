import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    FaShieldAlt,
    FaTrash,
    FaInfoCircle,
    FaCheckCircle,
    FaExclamationTriangle,
    FaTimes
} from 'react-icons/fa';
import { toast } from 'sonner';
import { getChats } from '@/lib/api';

interface CachedPermission {
    chat_id: string;
    chat_title: string;
    operations: string[];
}

export default function PermissionsSettings() {
    const [cachedPermissions, setCachedPermissions] = useState<CachedPermission[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCachedPermissions();
    }, []);

    const loadCachedPermissions = async () => {
        try {
            setLoading(true);

            // Get all chats
            const chats = await getChats();

            // Get permissions for each chat
            const permissionsPromises = chats.map(async (chat) => {
                try {
                    const operations = await invoke<string[]>('get_chat_permissions', {
                        chatId: chat.id
                    });

                    if (operations.length > 0) {
                        return {
                            chat_id: chat.id,
                            chat_title: chat.title,
                            operations
                        };
                    }
                    return null;
                } catch (error) {
                    console.error(`Failed to get permissions for chat ${chat.id}:`, error);
                    return null;
                }
            });

            const results = await Promise.all(permissionsPromises);
            const filtered = results.filter((p): p is CachedPermission => p !== null);

            setCachedPermissions(filtered);
        } catch (error) {
            console.error('Failed to load cached permissions:', error);
            toast.error('Failed to load permissions');
        } finally {
            setLoading(false);
        }
    };

    const handleClearPermission = async (chatId: string, operation: string) => {
        try {
            await invoke('clear_permission', {
                chatId,
                operation
            });

            toast.success(`Cleared permission for "${operation}"`);
            loadCachedPermissions();
        } catch (error) {
            console.error('Failed to clear permission:', error);
            toast.error('Failed to clear permission');
        }
    };

    const handleClearChatPermissions = async (chatId: string) => {
        try {
            await invoke('clear_chat_permissions', {
                chatId
            });

            toast.success('Cleared all permissions for this chat');
            loadCachedPermissions();
        } catch (error) {
            console.error('Failed to clear chat permissions:', error);
            toast.error('Failed to clear permissions');
        }
    };

    const totalOperations = cachedPermissions.reduce((sum, p) => sum + p.operations.length, 0);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header Info */}
            <Card className="border-blue-500/30 bg-blue-500/5">
                <CardHeader className="pb-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shrink-0">
                            <FaShieldAlt size={18} />
                        </div>
                        <div className="flex-1">
                            <CardTitle className="text-lg mb-1">Permission Management</CardTitle>
                            <CardDescription className="text-xs">
                                Manage cached permissions for approved operations. When you approve a permission,
                                it's cached so you don't get asked again in the same chat.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <FaCheckCircle className="text-primary" size={20} />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{totalOperations}</div>
                                <div className="text-xs text-muted-foreground">Cached Operations</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <FaShieldAlt className="text-blue-500" size={20} />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{cachedPermissions.length}</div>
                                <div className="text-xs text-muted-foreground">Chats with Permissions</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Info Alert */}
            <Alert>
                <FaInfoCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                    <strong>How it works:</strong> When you approve a permission request, it's cached for that chat.
                    Future requests for the same operation will be auto-approved. You can clear these permissions here.
                </AlertDescription>
            </Alert>

            {/* Permissions List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <FaShieldAlt className="text-primary" />
                        Cached Permissions by Chat
                    </CardTitle>
                    <CardDescription className="text-xs">
                        {cachedPermissions.length === 0
                            ? 'No cached permissions yet'
                            : `${cachedPermissions.length} chat${cachedPermissions.length !== 1 ? 's' : ''} with cached permissions`
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            Loading permissions...
                        </div>
                    ) : cachedPermissions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No cached permissions. Approve some permissions in a chat to see them here.
                        </div>
                    ) : (
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-4 pr-4">
                                {cachedPermissions.map((permission) => (
                                    <div
                                        key={permission.chat_id}
                                        className="p-4 rounded-lg border border-border/60 bg-card/50 space-y-3"
                                    >
                                        {/* Chat Header */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">
                                                    {permission.chat_title}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {permission.operations.length} cached operation{permission.operations.length !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleClearChatPermissions(permission.chat_id)}
                                                className="shrink-0 text-xs gap-1 h-7"
                                            >
                                                <FaTrash size={10} />
                                                Clear All
                                            </Button>
                                        </div>

                                        {/* Operations List */}
                                        <div className="flex flex-wrap gap-2">
                                            {permission.operations.map((operation) => (
                                                <Badge
                                                    key={operation}
                                                    variant="secondary"
                                                    className="text-xs gap-2 pr-1 pl-2 py-1"
                                                >
                                                    <span className="font-mono">{operation}</span>
                                                    <button
                                                        onClick={() => handleClearPermission(permission.chat_id, operation)}
                                                        className="hover:text-destructive transition-colors p-0.5 rounded hover:bg-destructive/10"
                                                    >
                                                        <FaTimes size={10} />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>

            {/* Danger Zone */}
            {cachedPermissions.length > 0 && (
                <Card className="border-destructive/30 bg-destructive/5">
                    <CardHeader className="pb-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center text-destructive shrink-0">
                                <FaExclamationTriangle size={18} />
                            </div>
                            <div className="flex-1">
                                <CardTitle className="text-base text-destructive mb-1">Danger Zone</CardTitle>
                                <CardDescription className="text-xs">
                                    This action cannot be undone. All cached permissions will be cleared.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                                if (confirm('Are you sure you want to clear ALL cached permissions? This will apply to all chats.')) {
                                    try {
                                        // Clear permissions for each chat
                                        await Promise.all(
                                            cachedPermissions.map(p =>
                                                invoke('clear_chat_permissions', { chatId: p.chat_id })
                                            )
                                        );
                                        toast.success('Cleared all cached permissions');
                                        loadCachedPermissions();
                                    } catch (error) {
                                        console.error('Failed to clear all permissions:', error);
                                        toast.error('Failed to clear all permissions');
                                    }
                                }
                            }}
                            className="gap-2"
                        >
                            <FaTrash />
                            Clear All Permissions
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
