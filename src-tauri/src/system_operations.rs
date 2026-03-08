use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::collections::HashMap;
use std::path::Path;
use std::fs;
use std::io::Read;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppInfo {
    pub name: String,
    pub path: String,
    pub icon: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub success: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileSystemOperation {
    pub operation_type: FileOperationType,
    pub source: String,
    pub destination: Option<String>,
    pub recursive: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum FileOperationType {
    Copy,
    Move,
    Delete,
    CreateDirectory,
    Rename,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub memory_usage: Option<u64>,
    pub cpu_usage: Option<f32>,
}

// Permission levels for operations
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum PermissionLevel {
    Safe,      // No permission needed
    Moderate,  // Requires confirmation
    Dangerous, // Requires explicit permission with warning
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OperationPermission {
    pub operation: String,
    pub description: String,
    pub level: PermissionLevel,
    pub details: HashMap<String, String>,
}

// App launching functions
pub fn launch_application(app_name_or_path: &str, args: Option<Vec<String>>) -> Result<u32> {
    let input = app_name_or_path.trim();

    // Check if it's a URL (http://, https://, or custom protocol like spotify:)
    let is_url = input.starts_with("http://")
        || input.starts_with("https://")
        || (input.contains(":") && !input.contains(":\\") && !input.contains(":/"));

    // Check if it looks like a full path
    let is_full_path = Path::new(input).is_absolute() || input.contains("\\") || input.starts_with("/");

    let mut command = if cfg!(target_os = "windows") {
        if is_url {
            // Open URL with default browser
            let mut cmd = Command::new("cmd");
            cmd.args(&["/C", "start", "", input]);
            cmd
        } else if is_full_path {
            // It's a full path - check if exists
            let path = Path::new(input);
            if !path.exists() {
                return Err(anyhow!("Application path does not exist: {}", input));
            }
            let mut cmd = Command::new("cmd");
            cmd.args(&["/C", "start", "", input]);
            if let Some(arguments) = &args {
                for arg in arguments {
                    cmd.arg(arg);
                }
            }
            cmd
        } else {
            // It's an app name - try to launch it
            // Windows can resolve common app names through PATH, Start Menu, etc.
            let resolved_app = resolve_windows_app_name(input);

            let mut cmd = Command::new("cmd");
            cmd.args(&["/C", "start", "", &resolved_app]);
            if let Some(arguments) = &args {
                for arg in arguments {
                    cmd.arg(arg);
                }
            }
            cmd
        }
    } else if cfg!(target_os = "macos") {
        if is_url {
            // Open URL with default browser
            let mut cmd = Command::new("open");
            cmd.arg(input);
            cmd
        } else if is_full_path {
            let path = Path::new(input);
            if !path.exists() {
                return Err(anyhow!("Application path does not exist: {}", input));
            }
            let mut cmd = Command::new("open");
            cmd.arg(input);
            if let Some(arguments) = &args {
                cmd.arg("--args");
                for arg in arguments {
                    cmd.arg(arg);
                }
            }
            cmd
        } else {
            // Try to find the app by name
            let resolved_app = resolve_macos_app_name(input);
            let mut cmd = Command::new("open");

            // Check if it's an app bundle path or just an app name
            if resolved_app.ends_with(".app") && Path::new(&resolved_app).exists() {
                cmd.arg(&resolved_app);
            } else {
                // Use -a flag to open by application name
                cmd.args(&["-a", &resolved_app]);
            }

            if let Some(arguments) = &args {
                cmd.arg("--args");
                for arg in arguments {
                    cmd.arg(arg);
                }
            }
            cmd
        }
    } else {
        // Linux
        if is_url {
            // Open URL with xdg-open
            let mut cmd = Command::new("xdg-open");
            cmd.arg(input);
            cmd
        } else if is_full_path {
            let path = Path::new(input);
            if !path.exists() {
                return Err(anyhow!("Application path does not exist: {}", input));
            }
            let mut cmd = Command::new(input);
            if let Some(arguments) = &args {
                for arg in arguments {
                    cmd.arg(arg);
                }
            }
            cmd
        } else {
            // Try to find the app in PATH or common locations
            let resolved_app = resolve_linux_app_name(input);
            let mut cmd = Command::new(&resolved_app);
            if let Some(arguments) = &args {
                for arg in arguments {
                    cmd.arg(arg);
                }
            }
            cmd
        }
    };

    let child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;

    Ok(child.id())
}

/// Resolve common Windows application names to executable names or paths
fn resolve_windows_app_name(name: &str) -> String {
    let name_lower = name.to_lowercase();

    // Map common app names to their executable names
    match name_lower.as_str() {
        // Browsers
        "chrome" | "google chrome" => "chrome".to_string(),
        "firefox" | "mozilla firefox" => "firefox".to_string(),
        "edge" | "microsoft edge" => "msedge".to_string(),
        "brave" => "brave".to_string(),
        "opera" => "opera".to_string(),

        // Microsoft Office
        "word" | "microsoft word" => "winword".to_string(),
        "excel" | "microsoft excel" => "excel".to_string(),
        "powerpoint" | "microsoft powerpoint" => "powerpnt".to_string(),
        "outlook" | "microsoft outlook" => "outlook".to_string(),
        "onenote" => "onenote".to_string(),

        // Development
        "vscode" | "visual studio code" | "code" => "code".to_string(),
        "visual studio" => "devenv".to_string(),
        "notepad++" | "notepadplusplus" => "notepad++".to_string(),
        "sublime" | "sublime text" => "subl".to_string(),

        // System
        "notepad" => "notepad".to_string(),
        "calculator" | "calc" => "calc".to_string(),
        "paint" => "mspaint".to_string(),
        "explorer" | "file explorer" => "explorer".to_string(),
        "cmd" | "command prompt" => "cmd".to_string(),
        "powershell" => "powershell".to_string(),
        "terminal" | "windows terminal" => "wt".to_string(),
        "task manager" | "taskmgr" => "taskmgr".to_string(),
        "control panel" => "control".to_string(),
        "settings" => "ms-settings:".to_string(),

        // Media
        "spotify" => "spotify".to_string(),
        "vlc" => "vlc".to_string(),
        "itunes" => "itunes".to_string(),

        // Communication
        "discord" => "discord".to_string(),
        "slack" => "slack".to_string(),
        "teams" | "microsoft teams" => "teams".to_string(),
        "zoom" => "zoom".to_string(),
        "skype" => "skype".to_string(),

        // Other
        "steam" => "steam".to_string(),
        "epic" | "epic games" => "EpicGamesLauncher".to_string(),

        // If not found, return as-is (let Windows try to resolve it)
        _ => name.to_string(),
    }
}

/// Resolve common macOS application names
fn resolve_macos_app_name(name: &str) -> String {
    let name_lower = name.to_lowercase();

    match name_lower.as_str() {
        // Browsers
        "chrome" | "google chrome" => "Google Chrome".to_string(),
        "firefox" | "mozilla firefox" => "Firefox".to_string(),
        "safari" => "Safari".to_string(),
        "brave" => "Brave Browser".to_string(),
        "edge" | "microsoft edge" => "Microsoft Edge".to_string(),

        // Development
        "vscode" | "visual studio code" | "code" => "Visual Studio Code".to_string(),
        "xcode" => "Xcode".to_string(),
        "terminal" => "Terminal".to_string(),
        "iterm" | "iterm2" => "iTerm".to_string(),
        "sublime" | "sublime text" => "Sublime Text".to_string(),

        // Productivity
        "finder" => "Finder".to_string(),
        "notes" => "Notes".to_string(),
        "calendar" => "Calendar".to_string(),
        "mail" => "Mail".to_string(),
        "messages" => "Messages".to_string(),
        "facetime" => "FaceTime".to_string(),
        "preview" => "Preview".to_string(),
        "textedit" | "text edit" => "TextEdit".to_string(),

        // Media
        "spotify" => "Spotify".to_string(),
        "music" | "apple music" => "Music".to_string(),
        "vlc" => "VLC".to_string(),
        "photos" => "Photos".to_string(),

        // Microsoft Office
        "word" | "microsoft word" => "Microsoft Word".to_string(),
        "excel" | "microsoft excel" => "Microsoft Excel".to_string(),
        "powerpoint" | "microsoft powerpoint" => "Microsoft PowerPoint".to_string(),
        "outlook" | "microsoft outlook" => "Microsoft Outlook".to_string(),
        "teams" | "microsoft teams" => "Microsoft Teams".to_string(),

        // Communication
        "slack" => "Slack".to_string(),
        "discord" => "Discord".to_string(),
        "zoom" => "zoom.us".to_string(),
        "skype" => "Skype".to_string(),

        // Other
        "activity monitor" => "Activity Monitor".to_string(),
        "system preferences" | "settings" => "System Preferences".to_string(),
        "app store" => "App Store".to_string(),

        // If not found, capitalize first letter of each word
        _ => name.split_whitespace()
            .map(|word| {
                let mut chars = word.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                }
            })
            .collect::<Vec<_>>()
            .join(" "),
    }
}

/// Resolve common Linux application names
fn resolve_linux_app_name(name: &str) -> String {
    let name_lower = name.to_lowercase();

    match name_lower.as_str() {
        // Browsers
        "chrome" | "google chrome" => "google-chrome".to_string(),
        "chromium" => "chromium-browser".to_string(),
        "firefox" | "mozilla firefox" => "firefox".to_string(),
        "brave" => "brave-browser".to_string(),
        "edge" | "microsoft edge" => "microsoft-edge".to_string(),

        // Development
        "vscode" | "visual studio code" | "code" => "code".to_string(),
        "sublime" | "sublime text" => "subl".to_string(),
        "atom" => "atom".to_string(),
        "gedit" => "gedit".to_string(),

        // File managers
        "nautilus" | "files" => "nautilus".to_string(),
        "dolphin" => "dolphin".to_string(),
        "thunar" => "thunar".to_string(),

        // Terminals
        "terminal" => "gnome-terminal".to_string(),
        "konsole" => "konsole".to_string(),
        "xterm" => "xterm".to_string(),

        // Media
        "spotify" => "spotify".to_string(),
        "vlc" => "vlc".to_string(),

        // Communication
        "slack" => "slack".to_string(),
        "discord" => "discord".to_string(),
        "teams" | "microsoft teams" => "teams".to_string(),
        "zoom" => "zoom".to_string(),

        // Calculator
        "calculator" | "calc" => "gnome-calculator".to_string(),

        // Settings
        "settings" => "gnome-control-center".to_string(),

        // If not found, return as-is (assume it's in PATH)
        _ => name.to_string(),
    }
}

// Get list of installed applications
pub fn get_installed_applications() -> Result<Vec<AppInfo>> {
    let mut apps = Vec::new();

    if cfg!(target_os = "windows") {
        // Windows: Check Program Files and common locations
        let user_profile_app_data = format!("{}\\AppData\\Local", std::env::var("USERPROFILE").unwrap_or_default());
        let program_files = vec![
            "C:\\Program Files",
            "C:\\Program Files (x86)",
            user_profile_app_data.as_str(),
        ];

        for dir in program_files {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    if let Ok(metadata) = entry.metadata() {
                        if metadata.is_dir() {
                            let name = entry.file_name().to_string_lossy().to_string();
                            
                            // Look for .exe files in the directory
                            if let Ok(exe_entries) = fs::read_dir(&entry.path()) {
                                for exe_entry in exe_entries.flatten() {
                                    if let Some(ext) = exe_entry.path().extension() {
                                        if ext == "exe" {
                                            apps.push(AppInfo {
                                                name: name.clone(),
                                                path: exe_entry.path().to_string_lossy().to_string(),
                                                icon: None,
                                                description: None,
                                            });
                                            break; // Take the first .exe found
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } else if cfg!(target_os = "macos") {
        // macOS: Check Applications folder
        if let Ok(entries) = fs::read_dir("/Applications") {
            for entry in entries.flatten() {
                if let Some(ext) = entry.path().extension() {
                    if ext == "app" {
                        let name = entry.file_name().to_string_lossy()
                            .replace(".app", "");
                        apps.push(AppInfo {
                            name,
                            path: entry.path().to_string_lossy().to_string(),
                            icon: None,
                            description: None,
                        });
                    }
                }
            }
        }
    } else {
        // Linux: Check common directories
        let home_app_dir = format!("{}/.local/share/applications", std::env::var("HOME").unwrap_or_default());
        let app_dirs = vec![
            "/usr/share/applications",
            "/usr/local/share/applications",
            home_app_dir.as_str(),
        ];

        for dir in app_dirs {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    if let Some(ext) = entry.path().extension() {
                        if ext == "desktop" {
                            // Parse .desktop file for app info
                            if let Ok(mut file) = fs::File::open(entry.path()) {
                                let mut contents = String::new();
                                if file.read_to_string(&mut contents).is_ok() {
                                    let mut name = String::new();
                                    let mut exec = String::new();
                                    
                                    for line in contents.lines() {
                                        if line.starts_with("Name=") {
                                            name = line.replace("Name=", "");
                                        } else if line.starts_with("Exec=") {
                                            exec = line.replace("Exec=", "").split_whitespace().next().unwrap_or("").to_string();
                                        }
                                    }
                                    
                                    if !name.is_empty() && !exec.is_empty() {
                                        apps.push(AppInfo {
                                            name,
                                            path: exec,
                                            icon: None,
                                            description: None,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(apps)
}

// Terminal command execution with safety checks
pub fn execute_terminal_command(command: &str, working_dir: Option<&str>) -> Result<CommandResult> {
    // Check if command is potentially dangerous
    let dangerous_commands = vec![
        "rm -rf /", "format", "del /f", "deltree", 
        "dd if=/dev/zero", "mkfs", "fdisk"
    ];
    
    for dangerous in &dangerous_commands {
        if command.to_lowercase().contains(dangerous) {
            return Err(anyhow!("Command blocked: potentially dangerous operation detected"));
        }
    }

    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(&["/C", command]);
        c
    } else {
        let mut c = Command::new("sh");
        c.args(&["-c", command]);
        c
    };

    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }

    let output = cmd
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()?;

    Ok(CommandResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
        success: output.status.success(),
    })
}

// Enhanced file operations
pub fn perform_file_operation(operation: &FileSystemOperation) -> Result<String> {
    let source_path = Path::new(&operation.source);
    
    match operation.operation_type {
        FileOperationType::Copy => {
            let dest = operation.destination.as_ref()
                .ok_or_else(|| anyhow!("Destination required for copy operation"))?;
            
            if source_path.is_file() {
                fs::copy(&operation.source, dest)?;
            } else if source_path.is_dir() && operation.recursive {
                copy_dir_recursive(source_path, Path::new(dest))?;
            } else {
                return Err(anyhow!("Source is a directory but recursive flag is not set"));
            }
            Ok(format!("Copied {} to {}", operation.source, dest))
        },
        
        FileOperationType::Move => {
            let dest = operation.destination.as_ref()
                .ok_or_else(|| anyhow!("Destination required for move operation"))?;
            fs::rename(&operation.source, dest)?;
            Ok(format!("Moved {} to {}", operation.source, dest))
        },
        
        FileOperationType::Delete => {
            if source_path.is_file() {
                fs::remove_file(&operation.source)?;
            } else if source_path.is_dir() {
                if operation.recursive {
                    fs::remove_dir_all(&operation.source)?;
                } else {
                    fs::remove_dir(&operation.source)?;
                }
            }
            Ok(format!("Deleted {}", operation.source))
        },
        
        FileOperationType::CreateDirectory => {
            if operation.recursive {
                fs::create_dir_all(&operation.source)?;
            } else {
                fs::create_dir(&operation.source)?;
            }
            Ok(format!("Created directory {}", operation.source))
        },
        
        FileOperationType::Rename => {
            let dest = operation.destination.as_ref()
                .ok_or_else(|| anyhow!("New name required for rename operation"))?;
            fs::rename(&operation.source, dest)?;
            Ok(format!("Renamed {} to {}", operation.source, dest))
        },
    }
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

// Get running processes
pub fn get_running_processes() -> Result<Vec<ProcessInfo>> {
    let mut processes = Vec::new();

    if cfg!(target_os = "windows") {
        let output = Command::new("wmic")
            .args(&["process", "get", "ProcessId,Name,WorkingSetSize", "/format:csv"])
            .output()?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines().skip(2) { // Skip headers
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() >= 4 {
                if let Ok(pid) = parts[2].parse::<u32>() {
                    let memory = parts[3].parse::<u64>().ok();
                    processes.push(ProcessInfo {
                        pid,
                        name: parts[1].to_string(),
                        memory_usage: memory,
                        cpu_usage: None,
                    });
                }
            }
        }
    } else {
        // Unix-like systems
        let output = Command::new("ps")
            .args(&["aux"])
            .output()?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines().skip(1) { // Skip header
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 11 {
                if let Ok(pid) = parts[1].parse::<u32>() {
                    let cpu = parts[2].parse::<f32>().ok();
                    let memory = parts[5].parse::<u64>().ok();
                    processes.push(ProcessInfo {
                        pid,
                        name: parts[10].to_string(),
                        memory_usage: memory,
                        cpu_usage: cpu,
                    });
                }
            }
        }
    }

    Ok(processes)
}

// Kill a process
pub fn kill_process(pid: u32) -> Result<()> {
    if cfg!(target_os = "windows") {
        Command::new("taskkill")
            .args(&["/F", "/PID", &pid.to_string()])
            .output()?;
    } else {
        Command::new("kill")
            .args(&["-9", &pid.to_string()])
            .output()?;
    }
    
    Ok(())
}

// Check permission level for an operation
pub fn check_permission_level(operation: &str, params: &HashMap<String, serde_json::Value>) -> OperationPermission {
    let mut details = HashMap::new();
    
    match operation {
        "execute_command" => {
            if let Some(cmd) = params.get("command").and_then(|v| v.as_str()) {
                details.insert("command".to_string(), cmd.to_string());
                
                // Check for dangerous patterns
                let dangerous_patterns = vec![
                    "rm -rf", "del /f", "format", "fdisk", "dd if=",
                    "sudo", "admin", "registry", "regedit"
                ];
                
                let is_dangerous = dangerous_patterns.iter()
                    .any(|pattern| cmd.to_lowercase().contains(pattern));
                
                OperationPermission {
                    operation: "Execute Terminal Command".to_string(),
                    description: format!("Execute command: {}", cmd),
                    level: if is_dangerous { 
                        PermissionLevel::Dangerous 
                    } else { 
                        PermissionLevel::Moderate 
                    },
                    details,
                }
            } else {
                OperationPermission {
                    operation: "Execute Terminal Command".to_string(),
                    description: "Execute unknown command".to_string(),
                    level: PermissionLevel::Dangerous,
                    details,
                }
            }
        },
        
        "launch_app" => {
            if let Some(path) = params.get("path").and_then(|v| v.as_str()) {
                details.insert("application".to_string(), path.to_string());
                OperationPermission {
                    operation: "Launch Application".to_string(),
                    description: format!("Launch application: {}", path),
                    level: PermissionLevel::Moderate,
                    details,
                }
            } else {
                OperationPermission {
                    operation: "Launch Application".to_string(),
                    description: "Launch unknown application".to_string(),
                    level: PermissionLevel::Moderate,
                    details,
                }
            }
        },
        
        "delete_file" | "delete_directory" => {
            if let Some(path) = params.get("path").and_then(|v| v.as_str()) {
                details.insert("path".to_string(), path.to_string());
                
                // Check if it's a system directory
                let system_dirs = vec![
                    "C:\\Windows", "C:\\Program Files", "/usr", "/bin", "/etc",
                    "/System", "/Library", "/Applications"
                ];
                
                let is_system = system_dirs.iter()
                    .any(|dir| path.starts_with(dir));
                
                OperationPermission {
                    operation: "Delete File/Directory".to_string(),
                    description: format!("Delete: {}", path),
                    level: if is_system { 
                        PermissionLevel::Dangerous 
                    } else { 
                        PermissionLevel::Moderate 
                    },
                    details,
                }
            } else {
                OperationPermission {
                    operation: "Delete File/Directory".to_string(),
                    description: "Delete unknown path".to_string(),
                    level: PermissionLevel::Dangerous,
                    details,
                }
            }
        },
        
        "kill_process" => {
            if let Some(pid) = params.get("pid") {
                details.insert("pid".to_string(), pid.to_string());
                OperationPermission {
                    operation: "Kill Process".to_string(),
                    description: format!("Terminate process with PID: {}", pid),
                    level: PermissionLevel::Dangerous,
                    details,
                }
            } else {
                OperationPermission {
                    operation: "Kill Process".to_string(),
                    description: "Terminate unknown process".to_string(),
                    level: PermissionLevel::Dangerous,
                    details,
                }
            }
        },

        "launch_application" => {
            if let Some(app_name) = params.get("app_name").and_then(|v| v.as_str()) {
                details.insert("application".to_string(), app_name.to_string());
                OperationPermission {
                    operation: "Launch Application".to_string(),
                    description: format!("Launch application: {}", app_name),
                    level: PermissionLevel::Moderate,
                    details,
                }
            } else {
                OperationPermission {
                    operation: "Launch Application".to_string(),
                    description: "Launch unknown application".to_string(),
                    level: PermissionLevel::Moderate,
                    details,
                }
            }
        },

        "write_file" => {
            if let Some(path) = params.get("file_path").and_then(|v| v.as_str()) {
                details.insert("path".to_string(), path.to_string());

                // Check if it's a system file
                let system_dirs = vec![
                    "C:\\Windows", "C:\\Program Files", "/usr", "/bin", "/etc",
                    "/System", "/Library", "/Applications"
                ];

                let is_system = system_dirs.iter()
                    .any(|dir| path.starts_with(dir));

                OperationPermission {
                    operation: "Write File".to_string(),
                    description: format!("Write to file: {}", path),
                    level: if is_system {
                        PermissionLevel::Dangerous
                    } else {
                        PermissionLevel::Moderate
                    },
                    details,
                }
            } else {
                OperationPermission {
                    operation: "Write File".to_string(),
                    description: "Write to unknown file".to_string(),
                    level: PermissionLevel::Moderate,
                    details,
                }
            }
        },

        "read_file" | "search_files" | "read_directory" | "list_directory" | "open_file" => {
            if let Some(path) = params.get("file_path")
                .or_else(|| params.get("directory_path"))
                .and_then(|v| v.as_str())
            {
                details.insert("path".to_string(), path.to_string());
            }
            OperationPermission {
                operation: operation.to_string(),
                description: format!("Read operation: {}", operation),
                level: PermissionLevel::Safe,
                details,
            }
        },

        "get_current_directory" | "list_processes" => {
            OperationPermission {
                operation: operation.to_string(),
                description: format!("Information query: {}", operation),
                level: PermissionLevel::Safe,
                details,
            }
        },

        _ => OperationPermission {
            operation: operation.to_string(),
            description: format!("Operation: {}", operation),
            level: PermissionLevel::Moderate,  // Changed from Safe to Moderate!
            details,
        }
    }
}
