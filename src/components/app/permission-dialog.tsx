import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { FaExclamationTriangle, FaInfoCircle, FaShieldAlt } from "react-icons/fa";

interface PermissionRequest {
    operation: string;
    description: string;
    level: "Safe" | "Moderate" | "Dangerous";
    details: Record<string, string>;
    callback_id?: string;
}

export default function PermissionDialog() {
    const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);
    const [pendingRequests, setPendingRequests] = useState<PermissionRequest[]>([]);

    useEffect(() => {
        // Listen for permission requests from the backend
        const unlisten = listen<PermissionRequest>("permission_request", (event) => {
            const request = event.payload;
            
            // If there's no current request, show it immediately
            if (!permissionRequest) {
                setPermissionRequest(request);
            } else {
                // Otherwise, queue it
                setPendingRequests(prev => [...prev, request]);
            }
        });

        return () => {
            unlisten.then(fn => fn());
        };
    }, [permissionRequest]);

    // Process next request in queue when current one is handled
    useEffect(() => {
        if (!permissionRequest && pendingRequests.length > 0) {
            const [next, ...remaining] = pendingRequests;
            setPermissionRequest(next);
            setPendingRequests(remaining);
        }
    }, [permissionRequest, pendingRequests]);

    const handleResponse = async (approved: boolean) => {
        if (permissionRequest?.callback_id) {
            try {
                // Send response back to backend
                await invoke("handle_permission_response", {
                    callbackId: permissionRequest.callback_id,
                    approved
                });
            } catch (error) {
                console.error("Failed to send permission response:", error);
            }
        }
        setPermissionRequest(null);
    };

    if (!permissionRequest) return null;

    const getLevelIcon = () => {
        switch (permissionRequest.level) {
            case "Safe":
                return <FaInfoCircle className="h-5 w-5 text-green-500" />;
            case "Moderate":
                return <FaShieldAlt className="h-5 w-5 text-yellow-500" />;
            case "Dangerous":
                return <FaExclamationTriangle className="h-5 w-5 text-red-500" />;
        }
    };

    const getLevelBadge = () => {
        switch (permissionRequest.level) {
            case "Safe":
                return <Badge className="bg-green-100 text-green-800">Safe</Badge>;
            case "Moderate":
                return <Badge className="bg-yellow-100 text-yellow-800">Moderate</Badge>;
            case "Dangerous":
                return <Badge variant="destructive">Dangerous</Badge>;
        }
    };

    return (
        <AlertDialog open={true}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        {getLevelIcon()}
                        Permission Required
                        {getLevelBadge()}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                        <div>
                            <strong>Operation:</strong> {permissionRequest.operation}
                        </div>
                        <div>
                            <strong>Description:</strong> {permissionRequest.description}
                        </div>
                        
                        {Object.keys(permissionRequest.details).length > 0 && (
                            <div className="mt-3 p-3 bg-muted rounded-lg">
                                <strong className="block mb-2">Details:</strong>
                                {Object.entries(permissionRequest.details).map(([key, value]) => (
                                    <div key={key} className="text-sm">
                                        <span className="font-medium capitalize">{key.replace(/_/g, " ")}:</span>{" "}
                                        <code className="bg-background px-1 py-0.5 rounded text-xs">{value}</code>
                                    </div>
                                ))}
                            </div>
                        )}

                        {permissionRequest.level === "Dangerous" && (
                            <div className="mt-3 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                                <strong className="text-red-600 dark:text-red-400">⚠️ Warning:</strong>
                                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                    This operation could potentially harm your system or delete important files. 
                                    Only approve if you fully understand the consequences.
                                </p>
                            </div>
                        )}

                        {pendingRequests.length > 0 && (
                            <div className="text-sm text-muted-foreground">
                                {pendingRequests.length} more permission{pendingRequests.length > 1 ? "s" : ""} pending
                            </div>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => handleResponse(false)}>
                        Deny
                    </AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={() => handleResponse(true)}
                        className={permissionRequest.level === "Dangerous" ? "bg-red-600 hover:bg-red-700" : ""}
                    >
                        {permissionRequest.level === "Dangerous" ? "I Understand, Allow" : "Allow"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
