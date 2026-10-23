import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { listen } from "@tauri-apps/api/event";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  checkForUpdates,
  downloadAndInstallUpdate,
  restartApp,
  getAppVersion,
} from "@/lib/api";
import type {
  UpdateCheckResult,
  ReleaseAsset,
  DownloadProgressPayload,
  InstallType,
} from "@/lib/types";
import {
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Package,
  HardDrive,
  FileCode,
  ExternalLink,
  RotateCcw,
  Sparkles,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getInstallTypeLabel(type: InstallType): { title: string; desc: string; icon: string } {
  switch (type) {
    case "deb":
      return {
        title: "Debian / Ubuntu Package (.deb)",
        desc: "Installed system-wide. Updates require system password via Polkit.",
        icon: "🐧",
      };
    case "app_image":
      return {
        title: "Linux AppImage",
        desc: "Portable single-file application. Updated seamlessly in-place.",
        icon: "📦",
      };
    case "rpm":
      return {
        title: "RedHat / Fedora RPM Package (.rpm)",
        desc: "Installed system-wide via RPM. Updates require system authorization.",
        icon: "🎩",
      };
    case "dmg":
      return {
        title: "macOS Application (.dmg)",
        desc: "Installed in /Applications. Updates require macOS administrator credentials.",
        icon: "🍎",
      };
    case "windows_exe":
      return {
        title: "Windows Setup (.exe)",
        desc: "Installed via NSIS setup. Updates require Windows UAC elevation.",
        icon: "🪟",
      };
    case "windows_msi":
      return {
        title: "Windows MSI Installer (.msi)",
        desc: "Windows Installer package. Elevated execution via UAC.",
        icon: "🪟",
      };
    case "dev":
      return {
        title: "Development / Standalone Build",
        desc: "Running from source or local target directory.",
        icon: "🛠️",
      };
    default:
      return {
        title: "Standard Installation",
        desc: "Standalone or generic package distribution.",
        icon: "💻",
      };
  }
}

export default function UpdaterSettings() {
  const [currentVersion, setCurrentVersion] = useState<string>("0.6.0");
  const [updateData, setUpdateData] = useState<UpdateCheckResult | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<ReleaseAsset | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [progress, setProgress] = useState<DownloadProgressPayload | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastCheckedTime, setLastCheckedTime] = useState<string | null>(null);

  useEffect(() => {
    loadAppVersion();
    handleCheckUpdates(false);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    async function setupListener() {
      unlisten = await listen<DownloadProgressPayload>(
        "updater-download-progress",
        (event) => {
          setProgress(event.payload);
          if (event.payload.status === "done") {
            setDownloading(false);
            setInstalled(true);
            toast.success("Update package successfully installed!");
          } else if (event.payload.status === "error") {
            setDownloading(false);
            setErrorMessage(event.payload.message);
            toast.error(event.payload.message);
          }
        }
      );
    }
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const loadAppVersion = async () => {
    try {
      const ver = await getAppVersion();
      if (ver) setCurrentVersion(ver);
    } catch {
      // ignore
    }
  };

  const handleCheckUpdates = async (showToast = true) => {
    try {
      setChecking(true);
      setErrorMessage(null);
      const res = await checkForUpdates();
      setUpdateData(res);
      setCurrentVersion(res.current_version);
      setLastCheckedTime(new Date().toLocaleTimeString());

      if (res.matched_asset) {
        setSelectedAsset(res.matched_asset);
      } else if (res.release?.assets && res.release.assets.length > 0) {
        setSelectedAsset(res.release.assets[0]);
      }

      if (showToast) {
        if (res.has_update) {
          toast.info(`New version available: ${res.latest_version}`);
        } else {
          toast.success("ChatMe is up to date!");
        }
      }
    } catch (err: any) {
      console.error("Failed to check for updates:", err);
      const msg = err?.message || String(err);
      setErrorMessage(`Check failed: ${msg}`);
      if (showToast) {
        toast.error(`Check failed: ${msg}`);
      }
    } finally {
      setChecking(false);
    }
  };

  const handleStartUpdate = async () => {
    if (!selectedAsset) {
      toast.error("Please select an update package to download.");
      return;
    }

    try {
      setDownloading(true);
      setInstalled(false);
      setErrorMessage(null);
      setProgress({
        downloaded_bytes: 0,
        total_bytes: selectedAsset.size,
        percentage: 0,
        status: "downloading",
        message: `Starting download of ${selectedAsset.name}...`,
      });

      const res = await downloadAndInstallUpdate(
        selectedAsset.download_url,
        selectedAsset.name
      );

      if (res.success) {
        setInstalled(true);
        toast.success(res.message);
      } else {
        setErrorMessage(res.message);
        toast.error(res.message);
      }
    } catch (err: any) {
      console.error("Update installation error:", err);
      const msg = err?.message || String(err);
      setErrorMessage(msg);
      toast.error(`Installation failed: ${msg}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleRestart = async () => {
    try {
      await restartApp();
    } catch (err: any) {
      toast.error(`Restart failed: ${err}`);
    }
  };

  const installTypeInfo = updateData
    ? getInstallTypeLabel(updateData.install_type)
    : getInstallTypeLabel("dev");

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-200">
      {/* Header Card: Current Status & System Detection */}
      <Card className="border border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-md shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xl">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  ChatMe Auto-Updater
                  <Badge variant="outline" className="font-mono text-xs">
                    v{currentVersion}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Native cross-platform updater with automated system authorization
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCheckUpdates(true)}
                disabled={checking || downloading}
                className="gap-2 rounded-xl"
              >
                <RefreshCw
                  className={`w-4 h-4 ${checking ? "animate-spin text-primary" : ""}`}
                />
                {checking ? "Checking..." : "Check for Updates"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-muted/40 border border-border/40 text-xs">
            <div>
              <span className="text-muted-foreground block mb-0.5">Installed Format:</span>
              <span className="font-medium flex items-center gap-1.5 text-foreground">
                <span>{installTypeInfo.icon}</span>
                {installTypeInfo.title}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Authorization Method:</span>
              <span className="font-medium flex items-center gap-1 text-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                {updateData?.install_type === "deb" || updateData?.install_type === "rpm"
                  ? "Polkit (pkexec password prompt)"
                  : updateData?.install_type === "dmg"
                  ? "AppleScript Admin prompt"
                  : updateData?.install_type === "windows_exe" || updateData?.install_type === "windows_msi"
                  ? "Windows UAC Prompt"
                  : "Direct filesystem update"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Last Checked:</span>
              <span className="font-medium text-foreground">
                {lastCheckedTime ? `${lastCheckedTime}` : "Just now"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs space-y-1">
            <p className="font-semibold text-sm">Update Encountered an Issue</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Installed / Restart Banner */}
      {installed && (
        <Card className="border-green-500/40 bg-green-500/10 shadow-md">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground">
                  Update Ready to Apply!
                </h4>
                <p className="text-xs text-muted-foreground">
                  The new package has been installed to your system. Restart ChatMe to start using it.
                </p>
              </div>
            </div>
            <Button
              onClick={handleRestart}
              className="bg-green-600 hover:bg-green-700 text-white gap-2 font-medium shrink-0 rounded-xl"
            >
              <RotateCcw className="w-4 h-4" />
              Restart Application Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active Download & Installation Progress */}
      {downloading && progress && (
        <Card className="border-primary/40 bg-primary/5 shadow-md">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                {progress.status === "downloading"
                  ? "Downloading Update Package..."
                  : progress.status === "authorizing"
                  ? "Waiting for System Authorization (Enter password if prompted)..."
                  : progress.status === "installing"
                  ? "Installing Package..."
                  : "Finalizing..."}
              </span>
              <span className="font-mono font-bold text-primary">
                {progress.percentage.toFixed(1)}%
              </span>
            </div>

            {/* Progress Track */}
            <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.max(2, progress.percentage))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{progress.message}</span>
              {progress.total_bytes && (
                <span>
                  {formatBytes(progress.downloaded_bytes)} / {formatBytes(progress.total_bytes)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Release Card */}
      {updateData && updateData.release && (
        <Card className="border border-border/60 bg-card/60">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant={updateData.has_update ? "default" : "secondary"}
                    className={
                      updateData.has_update
                        ? "bg-primary text-primary-foreground gap-1"
                        : "gap-1 text-muted-foreground"
                    }
                  >
                    {updateData.has_update ? (
                      <>
                        <Sparkles className="w-3 h-3" />
                        Update Available
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        Latest Release Available
                      </>
                    )}
                  </Badge>
                  <span className="font-semibold text-base">
                    {updateData.release.name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-3">
                  <span>Tag: {updateData.release.tag_name}</span>
                  {updateData.release.published_at && (
                    <span>
                      Released:{" "}
                      {new Date(updateData.release.published_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                  <a
                    href={updateData.release.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:underline text-primary"
                  >
                    View on GitHub <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>

              {/* Install Trigger */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleStartUpdate}
                  disabled={downloading || installed || !selectedAsset}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-medium rounded-xl shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  {updateData.has_update ? "Download & Install Update" : "Download & Re-install"}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            {/* Target Package & Authorization details */}
            <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <HardDrive className="w-3.5 h-3.5 text-primary" />
                    Target Installation Package:
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically matched to your operating system and installation format.
                  </p>
                </div>

                {/* Detected Package Badge */}
                {selectedAsset && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/80 border border-border/60 text-xs font-mono text-foreground shrink-0 shadow-xs">
                    <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-medium truncate max-w-[260px] sm:max-w-xs">
                      {selectedAsset.name}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                      {formatBytes(selectedAsset.size)}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Authorization Note */}
              <div className="text-[11px] text-muted-foreground bg-background/60 p-2.5 rounded-lg border border-border/30 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-foreground">Authorization Requirement: </span>
                  {selectedAsset?.name.toLowerCase().endsWith(".deb") ||
                  selectedAsset?.name.toLowerCase().endsWith(".rpm") ? (
                    <span>
                      Package installation executes with <code>pkexec</code>. Your system will prompt you for your user/root password to install into system directories.
                    </span>
                  ) : selectedAsset?.name.toLowerCase().endsWith(".appimage") ? (
                    <span>
                      AppImage will be made executable and will update your existing AppImage binary directly.
                    </span>
                  ) : selectedAsset?.name.toLowerCase().endsWith(".dmg") ? (
                    <span>
                      macOS will mount the DMG and request administrator privileges to update <code>/Applications/ChatMe.app</code>.
                    </span>
                  ) : selectedAsset?.name.toLowerCase().endsWith(".exe") ||
                    selectedAsset?.name.toLowerCase().endsWith(".msi") ? (
                    <span>
                      Windows will prompt with User Account Control (UAC) to authorize running the installer with administrator permissions.
                    </span>
                  ) : (
                    <span>
                      Package will be saved to your local downloads directory.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Release Notes */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5" />
                Release Notes & Changelog
              </h4>
              <ScrollArea className="h-48 rounded-xl border border-border/50 bg-background/50 p-4">
                {updateData.release.body ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {updateData.release.body}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No release notes provided for this release.
                  </p>
                )}
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previous Release (only show the immediate previous version) */}
      {updateData && updateData.all_releases && updateData.all_releases.length > 1 && (
        <Card className="border border-border/60 bg-card/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
              Previous Release
            </CardTitle>
            <CardDescription className="text-xs">
              View the previous version from GitHub
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-1">
            {updateData.all_releases.slice(1, 2).map((rel) => (
              <div
                key={rel.tag_name}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-muted/20 text-xs hover:bg-muted/30 transition-colors"
              >
                <div>
                  <span className="font-semibold text-foreground mr-2">
                    {rel.name || rel.tag_name}
                  </span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {rel.tag_name}
                  </span>
                  {rel.published_at && (
                    <span className="text-muted-foreground text-[11px] ml-2">
                      ({new Date(rel.published_at).toLocaleDateString()})
                    </span>
                  )}
                </div>
                <a
                  href={rel.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                >
                  Release Assets <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
