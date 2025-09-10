use std::fs;
use std::path::Path;
use regex::Regex;
use walkdir::WalkDir;
use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: Option<u64>,
    pub modified: Option<String>,
    pub file_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub file_path: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryContents {
    pub files: Vec<FileInfo>,
    pub directories: Vec<FileInfo>,
    pub total_files: usize,
    pub total_directories: usize,
}

/// Open a file or directory with the default system application
pub fn open_with_default_app(path: &str) -> Result<()> {
    let path = Path::new(path);
    
    if !path.exists() {
        return Err(anyhow!("Path does not exist: {}", path.display()));
    }
    
    opener::open(path)
        .map_err(|e| anyhow!("Failed to open file with default app: {}", e))?;
    
    Ok(())
}

/// Read the contents of a directory and return file information
pub fn read_directory_contents(directory_path: &str, recursive: bool) -> Result<DirectoryContents> {
    let path = Path::new(directory_path);
    
    if !path.exists() {
        return Err(anyhow!("Directory does not exist: {}", path.display()));
    }
    
    if !path.is_dir() {
        return Err(anyhow!("Path is not a directory: {}", path.display()));
    }
    
    let mut files = Vec::new();
    let mut directories = Vec::new();
    
    if recursive {
        for entry in WalkDir::new(path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.path() == path {
                continue; // Skip the root directory itself
            }
            
            let file_info = create_file_info(entry.path())?;
            
            if file_info.is_directory {
                directories.push(file_info);
            } else {
                files.push(file_info);
            }
        }
    } else {
        let entries = fs::read_dir(path)
            .map_err(|e| anyhow!("Failed to read directory: {}", e))?;
        
        for entry in entries {
            let entry = entry.map_err(|e| anyhow!("Failed to read directory entry: {}", e))?;
            let file_info = create_file_info(&entry.path())?;
            
            if file_info.is_directory {
                directories.push(file_info);
            } else {
                files.push(file_info);
            }
        }
    }
    
    // Sort files and directories by name
    files.sort_by(|a, b| a.name.cmp(&b.name));
    directories.sort_by(|a, b| a.name.cmp(&b.name));
    
    Ok(DirectoryContents {
        total_files: files.len(),
        total_directories: directories.len(),
        files,
        directories,
    })
}

/// Search for text patterns in files using regex
pub fn search_in_files(
    directory_path: &str,
    pattern: &str,
    file_extension_filter: Option<&str>,
    case_sensitive: bool,
    recursive: bool,
    max_results: Option<usize>,
) -> Result<Vec<SearchResult>> {
    let path = Path::new(directory_path);
    
    if !path.exists() || !path.is_dir() {
        return Err(anyhow!("Invalid directory path: {}", path.display()));
    }
    
    // Compile regex pattern
    let regex = if case_sensitive {
        regex::RegexBuilder::new(pattern).build()
    } else {
        regex::RegexBuilder::new(pattern).case_insensitive(true).build()
    }
    .map_err(|e| anyhow!("Invalid regex pattern: {}", e))?;
    
    let mut results = Vec::new();
    let mut result_count = 0;
    
    let walker = if recursive {
        WalkDir::new(path).follow_links(false)
    } else {
        WalkDir::new(path).max_depth(1).follow_links(false)
    };
    
    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let file_path = entry.path();
            
            // Apply file extension filter if specified
            if let Some(ext_filter) = file_extension_filter {
                if let Some(extension) = file_path.extension() {
                    if extension.to_string_lossy().to_lowercase() != ext_filter.to_lowercase() {
                        continue;
                    }
                } else {
                    continue;
                }
            }
            
            // Skip binary files
            if is_binary_file(file_path)? {
                continue;
            }
            
            match search_in_file(file_path, &regex) {
                Ok(mut file_results) => {
                    for _result in &mut file_results {
                        result_count += 1;
                        if let Some(max) = max_results {
                            if result_count > max {
                                return Ok(results);
                            }
                        }
                    }
                    results.extend(file_results);
                }
                Err(_) => {
                    // Skip files that can't be read (e.g., permission issues)
                    continue;
                }
            }
        }
    }
    
    Ok(results)
}

/// Read file contents as text
pub fn read_file_contents(file_path: &str) -> Result<String> {
    let path = Path::new(file_path);
    
    if !path.exists() {
        return Err(anyhow!("File does not exist: {}", path.display()));
    }
    
    if !path.is_file() {
        return Err(anyhow!("Path is not a file: {}", path.display()));
    }
    
    // Check if file is binary
    if is_binary_file(path)? {
        return Err(anyhow!("Cannot read binary file as text: {}", path.display()));
    }
    
    fs::read_to_string(path)
        .map_err(|e| anyhow!("Failed to read file: {}", e))
}

/// Write contents to a file
pub fn write_file_contents(file_path: &str, contents: &str) -> Result<()> {
    let path = Path::new(file_path);
    
    // Create parent directories if they don't exist
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| anyhow!("Failed to create parent directories: {}", e))?;
    }
    
    fs::write(path, contents)
        .map_err(|e| anyhow!("Failed to write file: {}", e))?;
    
    Ok(())
}

/// Get file or directory information
fn create_file_info(path: &Path) -> Result<FileInfo> {
    let metadata = fs::metadata(path)
        .map_err(|e| anyhow!("Failed to read metadata for {}: {}", path.display(), e))?;
    
    let name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    
    let path_str = path.to_string_lossy().to_string();
    let is_directory = metadata.is_dir();
    let size = if is_directory { None } else { Some(metadata.len()) };
    
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| {
            time.duration_since(std::time::UNIX_EPOCH)
                .ok()
                .map(|duration| {
                    chrono::DateTime::from_timestamp(duration.as_secs() as i64, 0)
                        .unwrap_or_default()
                        .to_rfc3339()
                })
        });
    
    let file_type = if is_directory {
        Some("directory".to_string())
    } else {
        path.extension()
            .map(|ext| ext.to_string_lossy().to_lowercase())
            .or_else(|| {
                mime_guess::from_path(path)
                    .first()
                    .map(|mime| mime.type_().to_string())
            })
    };
    
    Ok(FileInfo {
        name,
        path: path_str,
        is_directory,
        size,
        modified,
        file_type,
    })
}

/// Search for pattern in a single file
fn search_in_file(file_path: &Path, regex: &Regex) -> Result<Vec<SearchResult>> {
    let contents = fs::read_to_string(file_path)
        .map_err(|e| anyhow!("Failed to read file {}: {}", file_path.display(), e))?;
    
    let mut results = Vec::new();
    let file_path_str = file_path.to_string_lossy().to_string();
    
    for (line_number, line) in contents.lines().enumerate() {
        for mat in regex.find_iter(line) {
            results.push(SearchResult {
                file_path: file_path_str.clone(),
                line_number: line_number + 1,
                line_content: line.to_string(),
                match_start: mat.start(),
                match_end: mat.end(),
            });
        }
    }
    
    Ok(results)
}

/// Check if a file is binary
fn is_binary_file(path: &Path) -> Result<bool> {
    // First check by extension
    if let Some(extension) = path.extension() {
        let ext = extension.to_string_lossy().to_lowercase();
        let binary_extensions = [
            "exe", "dll", "so", "dylib", "bin", "dat", "db", "sqlite", "sqlite3",
            "jpg", "jpeg", "png", "gif", "bmp", "ico", "webp", "svg",
            "mp3", "wav", "flac", "ogg", "mp4", "avi", "mkv", "mov",
            "zip", "rar", "7z", "tar", "gz", "bz2", "xz",
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
        ];
        
        if binary_extensions.contains(&ext.as_str()) {
            return Ok(true);
        }
    }
    
    // For small files, check content
    let metadata = fs::metadata(path)
        .map_err(|e| anyhow!("Failed to read metadata: {}", e))?;
    
    if metadata.len() > 8192 {
        // For large files, assume text if extension suggests it
        return Ok(false);
    }
    
    // Read first 512 bytes and check for null bytes
    let mut buffer = vec![0; 512];
    let bytes_read = match fs::File::open(path) {
        Ok(mut file) => {
            use std::io::Read;
            file.read(&mut buffer).unwrap_or(0)
        }
        Err(_) => return Ok(true), // Assume binary if can't read
    };
    
    // Check for null bytes (common in binary files)
    Ok(buffer[..bytes_read].contains(&0))
}
