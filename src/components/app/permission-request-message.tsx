import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import {
    FaExclamationTriangle,
    FaShieldAlt,
    FaCheck,
    FaTimes,
    FaChevronDown,
    FaChevronUp
} from 'react-icons/fa';
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
    const [expanded, setExpanded] = useState(false);

    // Auto-collapse when resolved
    useEffect(() => {
        if (permissionRequest.status !== 'pending') {
            setExpanded(false);
        }
    }, [permissionRequest.status]);

    const handleResponse = async (approved: boolean) => {
        if (permissionRequest.status !== 'pending' || responding) return;

        setResponding(true);
        try {
            await invoke('respond_to_permission', {
                requestId: permissionRequest.id,
                approved
            });
            onStatusUpdate(permissionRequest.id, approved ? 'approved' : 'denied');
        } catch (error) {
            console.error('Failed to respond to permission:', error);
        } finally {
            setResponding(false);
        }
    };

    const isPending = permissionRequest.status === 'pending';
    const isApproved = permissionRequest.status === 'approved';

    // Compact resolved state (when approved or denied)
    if (!isPending && !expanded) {
        return (
            <div 
                onClick={() => setExpanded(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/70 border border-border/40 text-xs text-muted-foreground transition-colors cursor-pointer select-none"
                title="Click to view permission details"
            >
                <div className="flex items-center gap-1.5">
                    {isApproved ? (
                        <FaCheck size={10} className="text-emerald-500" />
                    ) : (
                        <FaTimes size={10} className="text-rose-500" />
                    )}
                    <span className="font-mono font-medium text-foreground text-[11px]">
                        {permissionRequest.operation}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        {isApproved ? 'approved' : 'denied'}
                    </span>
                </div>
                <FaChevronDown size={9} className="opacity-50" />
            </div>
        );
    }

    // Pending or expanded state
    return (
        <div className={`rounded-xl border p-3 text-xs transition-all duration-200 ${
            isPending 
                ? 'border-amber-500/40 bg-amber-500/5 shadow-xs' 
                : 'border-border/60 bg-card/60'
        }`}>
            {/* Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                    {permissionRequest.level === 'Dangerous' ? (
                        <FaExclamationTriangle className="text-rose-500" size={13} />
                    ) : (
                        <FaShieldAlt className="text-amber-500" size={13} />
                    )}
                    <span className="font-semibold text-foreground">
                        {isPending ? 'Permission Authorization' : 'Permission Record'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-muted text-muted-foreground border border-border/40">
                        {permissionRequest.level}
                    </span>
                </div>

                {!isPending && (
                    <button 
                        onClick={() => setExpanded(false)}
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                    >
                        <FaChevronUp size={10} />
                    </button>
                )}
            </div>

            {/* Operation & description */}
            <div className="space-y-1 mb-2.5">
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-foreground font-medium">
                    <span>Operation:</span>
                    <span className="text-primary">{permissionRequest.operation}</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                    {permissionRequest.description}
                </p>
            </div>

            {/* Parameters / Details */}
            {permissionRequest.details && Object.keys(permissionRequest.details).length > 0 && (
                <div className="bg-muted/40 rounded-lg p-2 font-mono text-[10px] text-muted-foreground border border-border/40 space-y-1 mb-2.5">
                    {Object.entries(permissionRequest.details).map(([key, val]) => (
                        <div key={key} className="flex gap-2 truncate">
                            <span className="text-foreground/80 font-medium shrink-0">{key}:</span>
                            <span className="truncate">{String(val)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Action Buttons for Pending */}
            {isPending && (
                <div className="flex items-center gap-2 pt-1">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResponse(false)}
                        disabled={responding}
                        className="flex-1 h-7 text-xs rounded-lg border-border/60 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/40 cursor-pointer"
                    >
                        <FaTimes size={10} className="mr-1.5" />
                        Deny
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => handleResponse(true)}
                        disabled={responding}
                        className="flex-1 h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer"
                    >
                        <FaCheck size={10} className="mr-1.5" />
                        {responding ? 'Authorizing...' : 'Allow'}
                    </Button>
                </div>
            )}
        </div>
    );
}
