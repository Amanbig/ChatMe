# ChatMe v0.6.5 Release Notes 🚀

## 🌟 What's New in v0.6.5

A monumental update to ChatMe introducing a native **Cross-Platform Internal Auto-Updater with Privilege Authorization**, an authentic **Line-Wise System Terminal**, **Built-in DuckDuckGo Web Search**, **Native Cross-Platform TTS (Text-to-Speech)**, **Appearance & Google Fonts Typography Engine**, and comprehensive **Desktop Application Integrations**.

---

### 🔄 Native Cross-Platform Auto-Updater
- **In-App Seamless Updating**: ChatMe now automatically checks GitHub releases for updates and identifies the exact package matching your installation format.
- **Automated Privilege Elevation**:
  - **Linux (`.deb` / `.rpm`)**: Prompts for system authorization using the native Polkit (`pkexec`) dialog to update packages in `/usr` and `/opt`.
  - **Linux (AppImage)**: Applies executable permissions (`chmod +x`) and safely replaces the active AppImage binary in-place.
  - **macOS (`.dmg`)**: Mounts update image and requests administrator authorization via AppleScript to update `/Applications/ChatMe.app`.
  - **Windows (`.exe` / `.msi`)**: Triggers native Windows UAC elevation (`Start-Process -Verb RunAs`) to launch installers with administrator permissions.
- **Live Streaming Progress**: Real-time progress bar displaying download speed, downloaded vs. total megabytes, and step status (Downloading -> Authorizing -> Installing -> Ready to Restart).
- **One-Click Restart**: Relaunch ChatMe directly from Settings upon installation completion.
- **Auto-Detection**: The updater automatically selects the correct package for your OS without requiring manual configuration.

---

### 💻 System Line-Wise Terminal & Smart Editor Interceptor
- **Authentic Linewise Terminal**: Refactored developer terminal to display genuine terminal output linewise in real time.
- **GUI File Editor Interception**: Commands like `vim`, `nano`, `vi`, `emacs`, `edit`, and `open` automatically launch your desktop GUI editor or system default text editor rather than hanging non-interactive terminal sessions.
- **Global `Ctrl+C` Process Cancellation**: Instantly interrupt running terminal commands from anywhere in the app.
- **Persistent Command History**: Navigate previous shell executions seamlessly with Up/Down arrow keys.

---

### 🌐 Built-in DuckDuckGo Search Engine
- Search the web for up-to-date documentation, articles, and technical information using built-in DuckDuckGo search without requiring external API keys.

---

### 🔊 Native Cross-Platform Speech (TTS)
- Dedicated native speech backend for each platform:
  - **Linux**: `spd-say` (Speech Dispatcher)
  - **macOS**: `say` (Native Apple Speech Synthesis)
  - **Windows**: SAPI via PowerShell `System.Speech`
- Configurable speech rate, pitch, and voice selection in Settings with test voice previews.

---

### 🎨 Appearance & Typography Settings
- **Google Fonts Typography Engine**: Switch between popular developer and UI typefaces:
  - *Inter*, *Roboto*, *Open Sans*, *JetBrains Mono*, *Fira Code*, *Outfit*, and more.
- Dynamic font size adjustment with instant real-time live preview.

---

### 🖥️ ChatGPT Desktop-Style "Work with Apps"
- Connect ChatMe with installed desktop applications:
  - **VS Code & Cursor**: Seamlessly attaches workspace paths and project file context.
  - **Developer Terminal**: Grants shell execution authorization and working directory awareness.
  - **Web Browsers (Chrome / Firefox / Edge)**: Inspects live URLs, scrapes technical documentation, and parses web content.
  - **File Explorer**: Reads folder trees and manages project assets.
- Clean user prompt bubbles with contextual app integration indicators.

---

### 🤖 Multi-Agent Autonomous Swarm
- Delegate complex workflows to specialized sub-agents:
  - 🧠 **Planner / Architecture Agent**: Decomposes high-level objectives into phased roadmaps.
  - 💻 **Full-Stack Coder Agent**: Writes production-grade components, refactors code, and runs diffs.
  - 🔍 **Research & Intelligence Agent**: Scrapes web docs and inspects codebase patterns.
  - 🛡️ **Quality & Security Reviewer**: Audits proposed changes for safety and edge cases.
  - ⚡ **System & DevOps Agent**: Monitors system diagnostics and shell execution.
- Interactive **Agent Orchestrator Cards** visualizes sub-agent delegations and task outcomes.

---

### ⚡ Interactive CodeBlock & Direct Runner
- Direct **"Run"** action on code blocks (`bash`, `sh`, `python`, `node`, `powershell`) with inline terminal output drawer showing exit codes, stdout, stderr, and execution duration.
- Automatic interactive line-by-line colored **Diff Viewer** for `diff` and `patch` blocks (emerald for additions, rose for deletions).

---

### 🛡️ Centralized Error Handling & Recovery
- Centralized `error-handler.ts` categorizing network, system, authorization, and syntax errors.
- Global React `ErrorBoundary` and inline chat recovery banners with one-click Retry action.

---

### 🐧 Linux GPU & WebKitGTK Rendering Fix
- Resolved `KMS: DRM_IOCTL_MODE_CREATE_DUMB failed: Permission denied` and `Failed to create GBM buffer` errors on Linux NVIDIA drivers via `WEBKIT_DISABLE_DMABUF_RENDERER=1`.

---

### Assets & Installation
Download the binary for your operating system below:
- **macOS**: `.dmg` (Apple Silicon & Intel)
- **Linux**: `.AppImage` / `.deb` / `.rpm`
- **Windows**: `.exe` (NSIS Setup) / `.msi` (Windows Installer)
