import { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    FaShieldAlt,
    FaExclamationTriangle,
    FaCheck,
    FaTimes,
    FaTerminal,
    FaFolderOpen,
    FaGlobe,
    FaRocket
} from 'react-icons/fa';
import type { Message } from '@/lib/types';

interface PendingPermission {
    id: string;
    chatId: string;
    operation: string;
    description: string;
    level: 'Safe' | 'Low' | 'Moderate' | 'High' | 'Dangerous';
    details?: Record<string, any>;
}

export default function PermissionDialog() {
    const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
    const [isResponding, setIsResponding] = useState(false);

    // Listen for permission messages created by Rust backend
    useEffect(() => {
        let unlistenPermissionMessage: (() => void) | undefined;

        const setupListener = async () => {
            unlistenPermissionMessage = await listen<Message>('permission_message_created', (event) => {
                const message = event.payload;
                if (message.permission_request && message.permission_request.status === 'pending') {
                    const perm = message.permission_request;
                    setPendingPermission({
                        id: perm.id,
                        chatId: perm.chat_id,
                        operation: perm.operation,
                        description: perm.description,
                        level: perm.level as PendingPermission['level'],
                        details: perm.details,
                    });
                }
            });
        };

        setupListener();

        return () => {
            if (unlistenPermissionMessage) {
                unlistenPermissionMessage();
            }
        };
    }, []);

    const handleRespond = useCallback(async (approved: boolean) => {
        if (!pendingPermission || isResponding) return;

        setIsResponding(true);
        const current = pendingPermission;

        try {
            await invoke('respond_to_permission', {
                requestId: current.id,
                approved,
            });

            if (approved) {
                toast.success(`Permission approved: ${current.operation}`);
            } else {
                toast.error(`Permission denied: ${current.operation}`);
            }

            // Dismiss dialog
            setPendingPermission(null);
        } catch (error) {
            console.error('Failed to respond to permission:', error);
            toast.error(`Failed to record response: ${error}`);
        } finally {
            setIsResponding(false);
        }
    }, [pendingPermission, isResponding]);

    // Keyboard shortcuts: Enter to approve, Escape to deny
    useEffect(() => {
        if (!pendingPermission) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleRespond(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pendingPermission, handleRespond]);

    if (!pendingPermission) return null;

    const isDangerous = pendingPermission.level === 'Dangerous';
    const isModerateOrHigh = pendingPermission.level === 'Moderate' || pendingPermission.level === 'High';

    const getOperationIcon = (op: string) => {
        switch (op) {
            case 'execute_command':
            case 'run_command':
                return <FaTerminal className="text-amber-500" size={16} />;
            case 'write_file':
            case 'read_file':
                return <FaFolderOpen className="text-blue-500" size={16} />;
            case 'fetch_url':
                return <FaGlobe className="text-emerald-500" size={16} />;
            case 'launch_app':
                return <FaRocket className="text-purple-500" size={16} />;
            default:
                return isDangerous ? (
                    <FaExclamationTriangle className="text-rose-500" size={16} />
                ) : (
                    <FaShieldAlt className="text-amber-500" size={16} />
                );
        }
    };

    const getLevelBadge = (level: string) => {
        switch (level) {
            case 'Dangerous':
                return <Badge variant="destructive" className="font-mono text-[11px]">Dangerous</Badge>;
            case 'High':
                return <Badge className="bg-amber-600/90 text-white font-mono text-[11px]">High Risk</Badge>;
            case 'Moderate':
                return <Badge className="bg-amber-500/80 text-white font-mono text-[11px]">Moderate</Badge>;
            case 'Low':
                return <Badge variant="secondary" className="font-mono text-[11px]">Low</Badge>;
            default:
                return <Badge variant="outline" className="font-mono text-[11px]">{level}</Badge>;
        }
    };

    return (
        <AlertDialog open={!!pendingPermission}>
            <AlertDialogContent className="sm:max-w-lg border-border/80 shadow-2xl bg-card">
                <AlertDialogHeader className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-xl ${
                                isDangerous
                                    ? 'bg-rose-500/10 border border-rose-500/20 text-rose-500'
                                    : isModerateOrHigh
                                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500'
                                    : 'bg-primary/10 border border-primary/20 text-primary'
                            }`}>
                                {getOperationIcon(pendingPermission.operation)}
                            </div>
                            <div>
                                <AlertDialogTitle className="text-base font-semibold">
                                    Action Authorization Required
                                </AlertDialogTitle>
                                <span className="text-xs text-muted-foreground">
                                    ChatMe agent is requesting permission to execute an action
                                </span>
                            </div>
                        </div>
                        {getLevelBadge(pendingPermission.level)}
                    </div>

                    <AlertDialogDescription className="text-sm text-foreground/90 bg-muted/30 p-3 rounded-lg border border-border/50 text-left">
                        {pendingPermission.description}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {/* Details Section */}
                <div className="space-y-2 text-left">
                    <div className="flex items-center justify-between text-xs font-mono text-muted-foreground px-1">
                        <span>Target Operation:</span>
                        <span className="font-semibold text-foreground">{pendingPermission.operation}</span>
                    </div>

                    {pendingPermission.details && Object.keys(pendingPermission.details).length > 0 && (
                        <div className="rounded-lg bg-muted/60 p-3 border border-border/60 font-mono text-xs max-h-48 overflow-y-auto space-y-1.5">
                            {Object.entries(pendingPermission.details).map(([key, val]) => (
                                <div key={key} className="break-all">
                                    <span className="text-muted-foreground select-none">{key}: </span>
                                    <span className="text-foreground font-medium">{String(val)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <AlertDialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleRespond(false)}
                        disabled={isResponding}
                        className="rounded-lg h-9 px-4 text-xs hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/40 cursor-pointer"
                    >
                        <FaTimes size={12} className="mr-1.5" />
                        Deny
                    </Button>
                    <Button
                        type="button"
                        onClick={() => handleRespond(true)}
                        disabled={isResponding}
                        className={`rounded-lg h-9 px-4 text-xs font-medium cursor-pointer ${
                            isDangerous
                                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                        }`}
                    >
                        <FaCheck size={12} className="mr-1.5" />
                        {isResponding ? 'Processing...' : 'Allow Action'}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
