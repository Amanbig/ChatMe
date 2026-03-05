import { useEffect, useState } from "react";
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

interface PermissionRequest {
    id: string;
    operation: string;
    description: string;
    level: "Safe" | "Moderate" | "Dangerous";
    details: Record<string, string>;
}

export default function PermissionDialog() {
    const [request, setRequest] = useState<PermissionRequest | null>(null);
    const [responding, setResponding] = useState(false);

    useEffect(() => {
        const unlisten = listen<PermissionRequest>("permission_request", (event) => {
            setRequest(event.payload);
        });

        return () => {
            unlisten.then((fn) => fn());
        };
    }, []);

    const handleResponse = async (approved: boolean) => {
        if (!request) return;

        setResponding(true);
        try {
            await invoke("respond_to_permission", {
                requestId: request.id,
                approved,
            });
            setRequest(null);
        } catch (error) {
            console.error("Failed to respond to permission:", error);
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
        <AlertDialog open={!!request}>
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
