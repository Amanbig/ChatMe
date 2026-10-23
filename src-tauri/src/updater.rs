use anyhow::{anyhow, Result};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Window};
use tokio::io::AsyncWriteExt;

const GITHUB_REPO: &str = "Amanbig/ChatMe";
const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseAsset {
    pub name: String,
    pub size: u64,
    pub download_url: String,
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseInfo {
    pub tag_name: String,
    pub version: String,
    pub name: String,
    pub body: String,
    pub published_at: Option<String>,
    pub html_url: String,
    pub assets: Vec<ReleaseAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InstallType {
    AppImage,
    Deb,
    Rpm,
    Dmg,
    WindowsExe,
    WindowsMsi,
    Dev,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub install_type: InstallType,
    pub install_path: Option<String>,
    pub matched_asset: Option<ReleaseAsset>,
    pub release: Option<ReleaseInfo>,
    pub all_releases: Vec<ReleaseInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percentage: f32,
    pub status: String, // "downloading" | "authorizing" | "installing" | "done" | "error"
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallResult {
    pub success: bool,
    pub message: String,
    pub requires_restart: bool,
}

/// Parse semantic version from a tag like "app-v0.5.3" or "v0.6.0"
pub fn parse_version(tag: &str) -> (u64, u64, u64) {
    let clean = tag.trim_start_matches(|c: char| !c.is_ascii_digit());
    let parts: Vec<&str> = clean.split('.').collect();
    let major = parts.get(0).and_then(|s| s.split('-').next()).and_then(|s| s.parse().ok()).unwrap_or(0);
    let minor = parts.get(1).and_then(|s| s.split('-').next()).and_then(|s| s.parse().ok()).unwrap_or(0);
    let patch = parts.get(2).and_then(|s| s.split('-').next()).and_then(|s| s.parse().ok()).unwrap_or(0);
    (major, minor, patch)
}

/// Compare two versions. Returns true if ver_a is strictly greater than ver_b
pub fn is_newer(ver_a: &str, ver_b: &str) -> bool {
    let a = parse_version(ver_a);
    let b = parse_version(ver_b);
    a > b
}

/// Detect the environment and how ChatMe is installed
pub fn detect_install_type() -> (InstallType, Option<String>) {
    // 1. Check for AppImage runtime environment variable
    if let Ok(appimage_path) = std::env::var("APPIMAGE") {
        if !appimage_path.is_empty() {
            return (InstallType::AppImage, Some(appimage_path));
        }
    }

    let current_exe = match std::env::current_exe() {
        Ok(path) => path,
        Err(_) => return (InstallType::Unknown, None),
    };
    let exe_str = current_exe.to_string_lossy().to_string();

    #[cfg(target_os = "linux")]
    {
        // If current exe ends with .AppImage
        if exe_str.to_lowercase().ends_with(".appimage") {
            return (InstallType::AppImage, Some(exe_str));
        }

        // If installed system-wide in /usr or /opt
        if exe_str.starts_with("/usr") || exe_str.starts_with("/opt") {
            if Path::new("/var/lib/dpkg").exists() {
                return (InstallType::Deb, Some(exe_str));
            } else if Path::new("/var/lib/rpm").exists() {
                return (InstallType::Rpm, Some(exe_str));
            }
            return (InstallType::Deb, Some(exe_str));
        }

        // Development mode
        if exe_str.contains("/target/debug/") || exe_str.contains("/target/release/") {
            return (InstallType::Dev, Some(exe_str));
        }

        (InstallType::Dev, Some(exe_str))
    }

    #[cfg(target_os = "macos")]
    {
        if exe_str.contains(".app") {
            return (InstallType::Dmg, Some(exe_str));
        }
        if exe_str.contains("/target/") {
            return (InstallType::Dev, Some(exe_str));
        }
        (InstallType::Dmg, Some(exe_str))
    }

    #[cfg(target_os = "windows")]
    {
        if exe_str.contains("Program Files") || exe_str.contains("AppData") {
            return (InstallType::WindowsExe, Some(exe_str));
        }
        if exe_str.contains(r"\target\") {
            return (InstallType::Dev, Some(exe_str));
        }
        (InstallType::WindowsExe, Some(exe_str))
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        (InstallType::Unknown, Some(exe_str))
    }
}

/// Match the best release asset based on OS, architecture, and installation type
pub fn find_best_asset<'a>(assets: &'a [ReleaseAsset], install_type: &InstallType) -> Option<&'a ReleaseAsset> {
    let arch = std::env::consts::ARCH; // e.g. "x86_64", "aarch64"
    let is_arm = arch == "aarch64" || arch == "arm";

    #[cfg(target_os = "linux")]
    {
        match install_type {
            InstallType::AppImage => {
                assets.iter().find(|a| {
                    let n = a.name.to_lowercase();
                    n.ends_with(".appimage") && (if is_arm { n.contains("aarch64") || n.contains("arm64") } else { n.contains("amd64") || n.contains("x86_64") })
                }).or_else(|| assets.iter().find(|a| a.name.to_lowercase().ends_with(".appimage")))
            },
            InstallType::Deb => {
                assets.iter().find(|a| {
                    let n = a.name.to_lowercase();
                    n.ends_with(".deb") && (if is_arm { n.contains("arm64") || n.contains("aarch64") } else { n.contains("amd64") || n.contains("x86_64") })
                }).or_else(|| assets.iter().find(|a| a.name.to_lowercase().ends_with(".deb")))
            },
            InstallType::Rpm => {
                assets.iter().find(|a| {
                    let n = a.name.to_lowercase();
                    n.ends_with(".rpm") && (if is_arm { n.contains("aarch64") } else { n.contains("x86_64") })
                }).or_else(|| assets.iter().find(|a| a.name.to_lowercase().ends_with(".rpm")))
            },
            InstallType::Dev | InstallType::Unknown => {
                if Path::new("/var/lib/dpkg").exists() {
                    assets.iter().find(|a| a.name.to_lowercase().ends_with(".deb"))
                        .or_else(|| assets.iter().find(|a| a.name.to_lowercase().ends_with(".appimage")))
                } else {
                    assets.iter().find(|a| a.name.to_lowercase().ends_with(".appimage"))
                        .or_else(|| assets.iter().find(|a| a.name.to_lowercase().ends_with(".deb")))
                }
            },
            _ => assets.iter().find(|a| a.name.to_lowercase().ends_with(".deb") || a.name.to_lowercase().ends_with(".appimage")),
        }
    }

    #[cfg(target_os = "macos")]
    {
        assets.iter().find(|a| {
            let n = a.name.to_lowercase();
            n.ends_with(".dmg") && (if is_arm { n.contains("aarch64") || n.contains("arm64") } else { n.contains("x64") || n.contains("x86_64") })
        }).or_else(|| assets.iter().find(|a| a.name.to_lowercase().ends_with(".dmg")))
    }

    #[cfg(target_os = "windows")]
    {
        assets.iter().find(|a| {
            let n = a.name.to_lowercase();
            n.ends_with("-setup.exe") || (n.ends_with(".exe") && !n.ends_with(".msi"))
        }).or_else(|| assets.iter().find(|a| a.name.to_lowercase().ends_with(".msi")))
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        assets.first()
    }
}

/// Check GitHub releases for updates
pub async fn check_for_updates() -> Result<UpdateCheckResult> {
    let (install_type, install_path) = detect_install_type();

    let client = reqwest::Client::builder()
        .user_agent(format!("ChatMe-Updater/{}", CURRENT_VERSION))
        .build()?;

    let url = format!("https://api.github.com/repos/{}/releases", GITHUB_REPO);
    let response = client.get(&url).send().await?;

    if !response.status().is_success() {
        return Err(anyhow!("Failed to fetch releases from GitHub: status {}", response.status()));
    }

    let raw_releases: serde_json::Value = response.json().await?;
    let releases_array = raw_releases.as_array().ok_or_else(|| anyhow!("Invalid releases format from GitHub"))?;

    let mut parsed_releases = Vec::new();
    for r in releases_array {
        let is_draft = r.get("draft").and_then(|v| v.as_bool()).unwrap_or(false);
        let is_prerelease = r.get("prerelease").and_then(|v| v.as_bool()).unwrap_or(false);
        if is_draft || is_prerelease {
            continue;
        }

        let tag_name = r.get("tag_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let clean_version = tag_name.trim_start_matches(|c: char| !c.is_ascii_digit()).to_string();
        let name = r.get("name").and_then(|v| v.as_str()).unwrap_or(&tag_name).to_string();
        let body = r.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let published_at = r.get("published_at").and_then(|v| v.as_str()).map(|s| s.to_string());
        let html_url = r.get("html_url").and_then(|v| v.as_str()).unwrap_or("").to_string();

        let mut assets = Vec::new();
        if let Some(assets_arr) = r.get("assets").and_then(|v| v.as_array()) {
            for a in assets_arr {
                let a_name = a.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let a_size = a.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
                let a_download = a.get("browser_download_url").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let a_content_type = a.get("content_type").and_then(|v| v.as_str()).map(|s| s.to_string());

                assets.push(ReleaseAsset {
                    name: a_name,
                    size: a_size,
                    download_url: a_download,
                    content_type: a_content_type,
                });
            }
        }

        parsed_releases.push(ReleaseInfo {
            tag_name,
            version: clean_version,
            name,
            body,
            published_at,
            html_url,
            assets,
        });
    }

    let latest_release = parsed_releases.first().cloned();
    let latest_version = latest_release.as_ref().map(|r| r.version.clone()).unwrap_or_else(|| CURRENT_VERSION.to_string());
    let has_update = is_newer(&latest_version, CURRENT_VERSION);

    let matched_asset = if let Some(ref rel) = latest_release {
        find_best_asset(&rel.assets, &install_type).cloned()
    } else {
        None
    };

    Ok(UpdateCheckResult {
        current_version: CURRENT_VERSION.to_string(),
        latest_version,
        has_update,
        install_type,
        install_path,
        matched_asset,
        release: latest_release,
        all_releases: parsed_releases,
    })
}

/// Download and install an update package with live progress reporting and privilege elevation
pub async fn download_and_install_update(
    window: Window,
    download_url: String,
    filename: String,
) -> Result<InstallResult> {
    let (_install_type, install_path) = detect_install_type();

    let client = reqwest::Client::builder()
        .user_agent(format!("ChatMe-Updater/{}", CURRENT_VERSION))
        .build()?;

    window.emit("updater-download-progress", DownloadProgressPayload {
        downloaded_bytes: 0,
        total_bytes: None,
        percentage: 0.0,
        status: "downloading".to_string(),
        message: format!("Connecting to download server for {}...", filename),
    })?;

    let response = client.get(&download_url).send().await
        .map_err(|e| anyhow!("Failed to initiate download: {}", e))?;

    if !response.status().is_success() {
        return Err(anyhow!("Failed to download update file: HTTP {}", response.status()));
    }

    let total_size = response.content_length();
    let temp_dir = std::env::temp_dir();
    let dest_path: PathBuf = temp_dir.join(&filename);

    let mut file = tokio::fs::File::create(&dest_path).await
        .map_err(|e| anyhow!("Failed to create temporary file {}: {}", dest_path.display(), e))?;

    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_emit_pct: f32 = 0.0;

    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| anyhow!("Download interrupted: {}", e))?;
        file.write_all(&chunk).await
            .map_err(|e| anyhow!("Failed to write to temporary file: {}", e))?;
        downloaded += chunk.len() as u64;

        let percentage = match total_size {
            Some(total) if total > 0 => ((downloaded as f64 / total as f64) * 100.0) as f32,
            _ => 0.0,
        };

        // Emit at ~0.5% intervals or when finished to avoid flooding UI events
        if percentage - last_emit_pct >= 0.5 || downloaded == total_size.unwrap_or(0) {
            last_emit_pct = percentage;
            let total_mb = total_size.unwrap_or(downloaded) as f64 / 1_048_576.0;
            let current_mb = downloaded as f64 / 1_048_576.0;
            let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage,
                status: "downloading".to_string(),
                message: format!("Downloading: {:.1} MB / {:.1} MB ({:.1}%)", current_mb, total_mb, percentage),
            });
        }
    }

    file.flush().await
        .map_err(|e| anyhow!("Failed to flush downloaded file: {}", e))?;
    drop(file);

    // Verify downloaded file exists and is non-empty
    let metadata = std::fs::metadata(&dest_path)
        .map_err(|e| anyhow!("Could not read downloaded file metadata: {}", e))?;
    if metadata.len() == 0 {
        return Err(anyhow!("Downloaded file is empty"));
    }

    // Now proceed to OS-specific installation with proper authorization
    let filename_lower = filename.to_lowercase();

    // Linux Installation
    #[cfg(target_os = "linux")]
    {
        if filename_lower.ends_with(".deb") {
            let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage: 100.0,
                status: "authorizing".to_string(),
                message: "System authorization required. Please enter your password when prompted...".to_string(),
            });

            // Use pkexec (Polkit GUI authorization dialog) to run dpkg
            let pkexec_check = std::process::Command::new("which")
                .arg("pkexec")
                .output();

            let has_pkexec = pkexec_check.map(|o| o.status.success()).unwrap_or(false);
            if !has_pkexec {
                return Err(anyhow!("Polkit authorization agent ('pkexec') not found. Please install the package manually from: {}", dest_path.display()));
            }

            let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage: 100.0,
                status: "installing".to_string(),
                message: "Installing package via dpkg (authorized)...".to_string(),
            });

            // Run pkexec dpkg -i <dest_path>
            let output = std::process::Command::new("pkexec")
                .args(&["dpkg", "-i", dest_path.to_str().unwrap()])
                .output()
                .map_err(|e| anyhow!("Failed to execute pkexec dpkg: {}", e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                // In case of unmet dependencies, try running apt-get install -f
                let _ = std::process::Command::new("pkexec")
                    .args(&["apt-get", "install", "-f", "-y"])
                    .output();
                if !output.status.success() {
                    return Err(anyhow!("Package installation failed: {}", stderr.trim()));
                }
            }

            let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage: 100.0,
                status: "done".to_string(),
                message: "Update successfully installed! Restart the application to apply.".to_string(),
            });

            return Ok(InstallResult {
                success: true,
                message: "Debian package successfully installed. You can now restart ChatMe.".to_string(),
                requires_restart: true,
            });
        } else if filename_lower.ends_with(".rpm") {
            let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage: 100.0,
                status: "authorizing".to_string(),
                message: "System authorization required. Please enter your password when prompted...".to_string(),
            });

            let output = std::process::Command::new("pkexec")
                .args(&["rpm", "-Uvh", "--replacepkgs", dest_path.to_str().unwrap()])
                .output()
                .map_err(|e| anyhow!("Failed to execute pkexec rpm: {}", e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(anyhow!("RPM installation failed: {}", stderr.trim()));
            }

            let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage: 100.0,
                status: "done".to_string(),
                message: "Update successfully installed! Restart the application to apply.".to_string(),
            });

            return Ok(InstallResult {
                success: true,
                message: "RPM package successfully installed.".to_string(),
                requires_restart: true,
            });
        } else if filename_lower.ends_with(".appimage") {
            // Make executable
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&dest_path)?.permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&dest_path, perms)?;

            let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage: 100.0,
                status: "installing".to_string(),
                message: "Configuring new AppImage...".to_string(),
            });

            // If running as an AppImage, replace running AppImage file
            if let Some(appimage_target) = install_path {
                let target_path = Path::new(&appimage_target);
                if target_path.exists() {
                    let backup_path = target_path.with_extension("appimage.old");
                    // Rename old to backup, move new to target
                    if let Err(_) = std::fs::rename(target_path, &backup_path) {
                        // Might need authorization if target directory is system-owned
                        let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                            downloaded_bytes: downloaded,
                            total_bytes: total_size,
                            percentage: 100.0,
                            status: "authorizing".to_string(),
                            message: "System authorization required to replace AppImage...".to_string(),
                        });
                        let mv_status = std::process::Command::new("pkexec")
                            .args(&["mv", dest_path.to_str().unwrap(), target_path.to_str().unwrap()])
                            .status()
                            .map_err(|e| anyhow!("Failed to move AppImage with pkexec: {}", e))?;
                        if !mv_status.success() {
                            return Err(anyhow!("Failed to replace system AppImage"));
                        }
                    } else {
                        // Successfully moved old to backup, now place new
                        if let Err(e) = std::fs::rename(&dest_path, target_path) {
                            // Restore backup
                            let _ = std::fs::rename(&backup_path, target_path);
                            return Err(anyhow!("Failed to replace AppImage: {}", e));
                        }
                        let _ = std::fs::remove_file(backup_path);
                    }

                    let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                        downloaded_bytes: downloaded,
                        total_bytes: total_size,
                        percentage: 100.0,
                        status: "done".to_string(),
                        message: "AppImage successfully updated! Restart application to launch new version.".to_string(),
                    });

                    return Ok(InstallResult {
                        success: true,
                        message: format!("AppImage updated at {}", target_path.display()),
                        requires_restart: true,
                    });
                }
            }

            // Fallback for standalone/dev: place in user Applications or home
            let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
            let apps_dir = home.join("Applications");
            let _ = std::fs::create_dir_all(&apps_dir);
            let final_appimage = apps_dir.join(&filename);
            let _ = std::fs::copy(&dest_path, &final_appimage);

            let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage: 100.0,
                status: "done".to_string(),
                message: format!("AppImage saved to {}", final_appimage.display()),
            });

            return Ok(InstallResult {
                success: true,
                message: format!("New AppImage is ready at {}. You can run it now.", final_appimage.display()),
                requires_restart: false,
            });
        }
    }

    // macOS Installation
    #[cfg(target_os = "macos")]
    {
        if filename_lower.ends_with(".dmg") {
            let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage: 100.0,
                status: "installing".to_string(),
                message: "Mounting update disk image (DMG)...".to_string(),
            });

            let mount_point = PathBuf::from("/tmp/ChatMe_Update_Mount");
            let _ = std::fs::create_dir_all(&mount_point);

            // Mount DMG
            let hdiutil_output = std::process::Command::new("hdiutil")
                .args(&[
                    "attach",
                    dest_path.to_str().unwrap(),
                    "-nobrowse",
                    "-mountpoint",
                    mount_point.to_str().unwrap(),
                    "-force",
                ])
                .output()
                .map_err(|e| anyhow!("Failed to mount DMG: {}", e))?;

            if !hdiutil_output.status.success() {
                return Err(anyhow!("DMG mount failed: {}", String::from_utf8_lossy(&hdiutil_output.stderr)));
            }

            let source_app = mount_point.join("ChatMe.app");
            let target_app = PathBuf::from("/Applications/ChatMe.app");

            let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage: 100.0,
                status: "authorizing".to_string(),
                message: "Copying to /Applications. System administrator authorization may be requested...".to_string(),
            });

            // Try standard copy first
            let mut copy_success = false;
            if let Ok(_) = std::process::Command::new("cp")
                .args(&["-R", source_app.to_str().unwrap(), "/Applications/"])
                .status()
                .map(|s| s.success())
            {
                copy_success = true;
            }

            // If standard copy failed, run AppleScript with administrator privileges (native macOS prompt)
            if !copy_success {
                let script = format!(
                    "do shell script \"cp -R '{}' /Applications/\" with administrator privileges",
                    source_app.display()
                );
                let osa_output = std::process::Command::new("osascript")
                    .args(&["-e", &script])
                    .output()
                    .map_err(|e| anyhow!("Authorization script failed: {}", e))?;

                if !osa_output.status.success() {
                    let _ = std::process::Command::new("hdiutil")
                        .args(&["detach", mount_point.to_str().unwrap(), "-force"])
                        .output();
                    return Err(anyhow!("Failed to copy application with administrator privileges: {}", String::from_utf8_lossy(&osa_output.stderr)));
                }
            }

            // Detach mount point
            let _ = std::process::Command::new("hdiutil")
                .args(&["detach", mount_point.to_str().unwrap(), "-force"])
                .output();

            let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage: 100.0,
                status: "done".to_string(),
                message: "ChatMe updated successfully in /Applications! Restart to apply.".to_string(),
            });

            return Ok(InstallResult {
                success: true,
                message: "ChatMe.app updated successfully in /Applications.".to_string(),
                requires_restart: true,
            });
        }
    }

    // Windows Installation
    #[cfg(target_os = "windows")]
    {
        if filename_lower.ends_with(".exe") || filename_lower.ends_with(".msi") {
            let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage: 100.0,
                status: "authorizing".to_string(),
                message: "Launching elevated Windows installer. Please accept the UAC prompt...".to_string(),
            });

            let status = if filename_lower.ends_with(".msi") {
                std::process::Command::new("powershell")
                    .args(&[
                        "-NoProfile",
                        "-Command",
                        &format!("Start-Process msiexec.exe -ArgumentList '/i \"{}\"' -Verb RunAs", dest_path.display())
                    ])
                    .status()
                    .map_err(|e| anyhow!("Failed to launch MSI installer: {}", e))?
            } else {
                std::process::Command::new("powershell")
                    .args(&[
                        "-NoProfile",
                        "-Command",
                        &format!("Start-Process -FilePath '{}' -Verb RunAs", dest_path.display())
                    ])
                    .status()
                    .map_err(|e| anyhow!("Failed to launch setup installer: {}", e))?
            };

            if !status.success() {
                return Err(anyhow!("Installer process exited with code {:?}", status.code()));
            }

            let _ = window.emit("updater-download-progress", DownloadProgressPayload {
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                percentage: 100.0,
                status: "done".to_string(),
                message: "Windows installer launched with administrator authorization.".to_string(),
            });

            return Ok(InstallResult {
                success: true,
                message: "Installer running. Follow the setup instructions to complete the update.".to_string(),
                requires_restart: false,
            });
        }
    }

    // Fallback if OS or extension didn't match known patterns
    let _ = window.emit("updater-download-progress", DownloadProgressPayload {
        downloaded_bytes: downloaded,
        total_bytes: total_size,
        percentage: 100.0,
        status: "done".to_string(),
        message: format!("Update package downloaded to {}", dest_path.display()),
    });

    Ok(InstallResult {
        success: true,
        message: format!("Package downloaded to {}. Please run it to complete installation.", dest_path.display()),
        requires_restart: false,
    })
}

/// Restart the application using Tauri 2 runtime restart
pub fn restart_application(app: &AppHandle) -> Result<()> {
    app.restart();
}
