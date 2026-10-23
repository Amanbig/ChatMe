import { useState, useEffect } from 'react';
import { detectDesktopApps, type ConnectedApp } from '@/lib/app-connector';
import { Plus, Check, Laptop, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface ConnectedAppsBarProps {
    attachedApps: ConnectedApp[];
    onToggleApp: (app: ConnectedApp) => void;
}

export default function ConnectedAppsBar({ attachedApps, onToggleApp }: ConnectedAppsBarProps) {
    const [availableApps, setAvailableApps] = useState<ConnectedApp[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadApps();
    }, []);

    const loadApps = async () => {
        try {
            setLoading(true);
            const detected = await detectDesktopApps();
            setAvailableApps(detected);
        } catch {
            // Fallback
        } finally {
            setLoading(false);
        }
    };

    const isAttached = (appId: string) => attachedApps.some(a => a.id === appId);

    return (
        <div className="relative">
            {/* Attached App Badges Bar */}
            <div className="flex items-center flex-wrap gap-1.5 px-1 py-1">
                {attachedApps.map((app) => (
                    <span
                        key={app.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-primary/15 text-primary border border-primary/30 shadow-xs animate-in zoom-in-95 duration-150"
                    >
                        <span>{app.icon}</span>
                        <span>{app.name}</span>
                        <button
                            type="button"
                            onClick={() => onToggleApp(app)}
                            className="hover:text-destructive hover:bg-destructive/10 rounded-full p-0.5 transition-colors cursor-pointer"
                            title={`Disconnect ${app.name}`}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}

                {/* Connect App Dropdown Trigger */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50 transition-colors cursor-pointer"
                    title="Connect with desktop apps like ChatGPT Desktop"
                >
                    <Laptop className="h-3 w-3 text-primary" />
                    <span>Work with Apps</span>
                    <Plus className="h-3 w-3" />
                </button>
            </div>

            {/* Apps Popover Menu */}
            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsOpen(false)} 
                    />
                    <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl bg-popover/95 backdrop-blur-md border border-border/80 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-border/40 text-xs">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                                Connect Desktop Apps
                            </span>
                            <span className="text-[10px] text-muted-foreground">ChatGPT Style</span>
                        </div>

                        <div className="space-y-1 max-h-56 overflow-y-auto p-0.5">
                            {loading ? (
                                <div className="text-center py-4 text-xs text-muted-foreground">
                                    Scanning desktop apps...
                                </div>
                            ) : (
                                availableApps.map((app) => {
                                    const attached = isAttached(app.id);
                                    return (
                                        <button
                                            key={app.id}
                                            type="button"
                                            onClick={() => {
                                                onToggleApp(app);
                                                toast.info(attached ? `Disconnected ${app.name}` : `Connected to ${app.name}`);
                                            }}
                                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                                                attached 
                                                    ? 'bg-primary/10 border border-primary/20 text-foreground' 
                                                    : 'hover:bg-muted/70 text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="text-base shrink-0">{app.icon}</span>
                                                <div className="truncate">
                                                    <div className="font-medium text-foreground flex items-center gap-1.5">
                                                        <span>{app.name}</span>
                                                        {app.status === 'connected' && (
                                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title="Running in background" />
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground truncate">{app.description}</p>
                                                </div>
                                            </div>

                                            {attached && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
