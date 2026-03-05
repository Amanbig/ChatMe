import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    FaExclamationTriangle,
    FaShieldAlt,
    FaInfoCircle,
    FaCheck,
    FaTimes,
    FaLock
} from 'react-icons/fa';
import { toast } from 'sonner';
import type { PermissionRequest } from '@/lib/types';

interface PermissionRequestMessageProps {
    permissionRequest: PermissionRequest;
    onStatusUpdate: (permissionId: string, status: 'approved' | 'denied') => void;
}

export default function PermissionRequestMessage({
    permissionRequest,
    onStatusUpdate
}: PermissionRequestMessageProps) {
    const [responding, setResponding] = useState(false);
    const [expanded, setExpanded] = useState(permissionRequest.status === 'pending');

    // Auto-collapse when permission is resolved
    useEffect(() => {
        if (permissionRequest.status !== 'pending') {
            // Wait a moment before collapsing so user sees the result
            const timer = setTimeout(() => setExpanded(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [permissionRequest.status]);

    const getLevelIcon = () => {
        switch (permissionRequest.level) {
            case 'Dangerous':
                return <FaExclamationTriangle className="text-destructive" size={16} />;
            case 'Moderate':
                return <FaShieldAlt className="text-yellow-500" size={16} />;
            default:
                return <FaInfoCircle className="text-blue-500" size={16} />;
        }
    };

    const getLevelColor = () => {
        switch (permissionRequest.level) {
            case 'Dangerous':
                return 'border-destructive/50 bg-destructive/5';
            case 'Moderate':
                return 'border-yellow-500/50 bg-yellow-500/5';
            default:
                return 'border-blue-500/50 bg-blue-500/5';
        }
    };

    const getStatusBadge = () => {
        switch (permissionRequest.status) {
            case 'approved':
                return (
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                        <FaCheck size={10} className="mr-1" />
                        Approved
                    </Badge>
                );
            case 'denied':
                return (
                    <Badge variant="destructive">
                        <FaTimes size={10} className="mr-1" />
                        Denied
                    </Badge>
                );
            default:
                return (
                    <Badge variant="secondary" className="animate-pulse">
                        <FaLock size={10} className="mr-1" />
                        Awaiting Permission
                    </Badge>
                );
        }
    };

    const handleResponse = async (approved: boolean) => {
        if (permissionRequest.status !== 'pending' || responding) {
            return;
        }

        setResponding(true);

        try {
            await invoke('respond_to_permission', {
                requestId: permissionRequest.id,
                approved
            });

            // Update the status in the parent
            onStatusUpdate(permissionRequest.id, approved ? 'approved' : 'denied');

            toast.success(approved ? 'Permission granted' : 'Permission denied');
        } catch (error) {
            console.error('Failed to respond to permission:', error);
            if (!String(error).includes('Permission request not found')) {
                toast.error('Failed to send permission response');
            }
        } finally {
            setResponding(false);
        }
    };

    // Collapsed view for resolved permissions
    if (permissionRequest.status !== 'pending' && !expanded) {
        return (
            <div
                onClick={() => setExpanded(true)}
                className="flex items-center gap-2 px-3 py-2 bg-muted/30 border border-muted-foreground/20 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
            >
                {getLevelIcon()}
                <span className="text-xs text-muted-foreground flex-1">
                    Permission {permissionRequest.status === 'approved' ? 'granted' : 'denied'}: {permissionRequest.operation}
                </span>
                {getStatusBadge()}
            </div>
        );
    }

    return (
        <Card className={`border-2 ${getLevelColor()} shadow-sm`}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {getLevelIcon()}
                        <span className="font-semibold text-sm">Permission Required</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {getStatusBadge()}
                        {permissionRequest.status !== 'pending' && (
                            <button
                                onClick={() => setExpanded(false)}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Collapse
                            </button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                {/* Operation Info */}
                <div className="space-y-2">
                    <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-muted-foreground min-w-[80px]">
                            Operation:
                        </span>
                        <span className="text-xs font-mono bg-muted/50 px-2 py-0.5 rounded">
                            {permissionRequest.operation}
                        </span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-muted-foreground min-w-[80px]">
                            Description:
                        </span>
                        <span className="text-xs">{permissionRequest.description}</span>
                    </div>
                </div>

                {/* Details */}
                {Object.keys(permissionRequest.details).length > 0 && (
                    <div className="rounded-lg border bg-muted/30 p-2.5">
                        <div className="text-xs font-semibold mb-1.5">Details:</div>
                        <div className="space-y-1">
                            {Object.entries(permissionRequest.details).map(([key, value]) => (
                                <div key={key} className="flex gap-2 text-xs">
                                    <span className="text-muted-foreground capitalize min-w-[60px]">
                                        {key}:
                                    </span>
                                    <span className="font-mono text-[11px] break-all flex-1">
                                        {value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Warning for dangerous operations */}
                {permissionRequest.level === 'Dangerous' && permissionRequest.status === 'pending' && (
                    <Alert variant="destructive" className="py-2">
                        <FaExclamationTriangle className="h-3 w-3" />
                        <AlertDescription className="text-xs">
                            <strong>Warning:</strong> This is a potentially dangerous operation.
                            Only approve if you understand what it does.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Action Buttons - only show if pending */}
                {permissionRequest.status === 'pending' && (
                    <div className="flex gap-2 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResponse(false)}
                            disabled={responding}
                            className="flex-1 h-8 text-xs"
                        >
                            <FaTimes size={10} className="mr-1" />
                            Deny
                        </Button>
                        <Button
                            variant={permissionRequest.level === 'Dangerous' ? 'destructive' : 'default'}
                            size="sm"
                            onClick={() => handleResponse(true)}
                            disabled={responding}
                            className="flex-1 h-8 text-xs"
                        >
                            <FaCheck size={10} className="mr-1" />
                            {responding ? 'Processing...' : 'Allow'}
                        </Button>
                    </div>
                )}

                {/* Status message for completed requests */}
                {permissionRequest.status !== 'pending' && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                        Permission {permissionRequest.status === 'approved' ? 'granted' : 'denied'} by user
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
