import { useEffect, useState, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FaExclamationTriangle, FaShieldAlt, FaInfoCircle } from "react-icons/fa";
import { toast } from "sonner";

interface PermissionRequest {
    id: string;
    operation: string;
    description: string;
    level: "Safe" | "Moderate" | "Dangerous";
    details: Record<string, string>;
    chat_id?: string;
}

export default function PermissionDialog() {
    const [request, setRequest] = useState<PermissionRequest | null>(null);
    const [responding, setResponding] = useState(false);
    const pendingRequestIdRef = useRef<string | null>(null);

    useEffect(() => {
        const unlisten = listen<PermissionRequest>("permission_request", (event) => {
            console.log('Permission request received:', event.payload);

            // Prevent duplicate dialogs - ignore if we're already showing a dialog
            if (pendingRequestIdRef.current) {
                console.log('Ignoring duplicate permission request, already showing dialog for:', pendingRequestIdRef.current);
                return;
            }

            pendingRequestIdRef.current = event.payload.id;
            setRequest(event.payload);
        });

        return () => {
            unlisten.then((fn) => fn());
        };
    }, []);

    useEffect(() => {
        console.log('Request state changed:', request ? `ID: ${request.id}` : 'null');
    }, [request]);

    const handleResponse = async (approved: boolean) => {
        if (!request || responding) {
            console.log('handleResponse called but no request or already responding');
            return;
        }

        console.log(`Responding to permission ${request.id}: ${approved ? 'APPROVED' : 'DENIED'}`);

        // Capture the request ID before setting responding
        const requestId = request.id;

        // Immediately set responding to prevent double-clicks
        setResponding(true);

        // Clear the dialog immediately to prevent re-renders
        setRequest(null);

        try {
            await invoke("respond_to_permission", {
                requestId: requestId,
                approved,
            });
            console.log('Permission response sent successfully');
        } catch (error) {
            console.error("Failed to respond to permission:", error);
            // Only show error if it's not "request not found" (which means it was already handled)
            if (!String(error).includes('Permission request not found')) {
                toast.error('Failed to send permission response');
            }
        } finally {
            setResponding(false);
        }
    };

    if (!request) return null;

    const getLevelIcon = () => {
        switch (request.level) {
            case "Dangerous":
                return <FaExclamationTriangle className="text-destructive" size={24} />;
            case "Moderate":
                return <FaShieldAlt className="text-yellow-500" size={24} />;
            default:
                return <FaInfoCircle className="text-blue-500" size={24} />;
        }
    };

    const getLevelColor = () => {
        switch (request.level) {
            case "Dangerous":
                return "border-destructive/50 bg-destructive/5";
            case "Moderate":
                return "border-yellow-500/50 bg-yellow-500/5";
            default:
                return "border-blue-500/50 bg-blue-500/5";
        }
    };

    return (
        <AlertDialog key={request?.id} open={!!request} onOpenChange={() => {
            // Prevent closing - user must explicitly allow or deny
        }}>
            <AlertDialogContent className="sm:max-w-[500px]">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        {getLevelIcon()}
                        <AlertDialogTitle className="text-xl">Permission Required</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription>
                        The application is requesting permission to perform an operation.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-4">
                    {/* Operation Info */}
                    <Alert className={getLevelColor()}>
                        <AlertDescription>
                            <div className="space-y-2">
                                <div>
                                    <span className="font-semibold">Operation:</span> {request.operation}
                                </div>
                                <div>
                                    <span className="font-semibold">Description:</span> {request.description}
                                </div>
                            </div>
                        </AlertDescription>
                    </Alert>

                    {/* Details */}
                    {Object.keys(request.details).length > 0 && (
                        <div className="rounded-lg border p-3 bg-muted/30">
                            <div className="text-sm font-semibold mb-2">Details:</div>
                            <div className="space-y-1 text-sm">
                                {Object.entries(request.details).map(([key, value]) => (
                                    <div key={key} className="flex gap-2">
                                        <span className="text-muted-foreground capitalize">{key}:</span>
                                        <span className="font-mono text-xs break-all">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Warning for dangerous operations */}
                    {request.level === "Dangerous" && (
                        <Alert variant="destructive">
                            <FaExclamationTriangle className="h-4 w-4" />
                            <AlertDescription>
                                <strong>Warning:</strong> This is a potentially dangerous operation.
                                Only approve if you understand what it does.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Info about permission caching */}
                    {request.chat_id && (
                        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                            <FaInfoCircle className="inline mr-1" />
                            If you allow this operation, you won't be asked again for this chat session.
                        </div>
                    )}
                </div>

                <AlertDialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => handleResponse(false)}
                        disabled={responding}
                    >
                        Deny
                    </Button>
                    <Button
                        variant={request.level === "Dangerous" ? "destructive" : "default"}
                        onClick={() => handleResponse(true)}
                        disabled={responding}
                    >
                        {responding ? "Processing..." : "Allow"}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
