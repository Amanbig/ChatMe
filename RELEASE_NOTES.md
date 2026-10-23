# ChatMe v0.6.0 Release Notes 🚀

## 🌟 What's New in v0.6.0

A major milestone release introducing ChatGPT Desktop-style App Integrations, Multi-Agent Autonomous Orchestration, an Interactive Code Runner & Diff Viewer, an Integrated Developer Terminal, Vite Bundle Optimization (-63%), and Chat Export.

### 🖥️ "Work with Apps" (ChatGPT Desktop Style)
- Connect ChatMe with your installed and running desktop applications:
  - **VS Code & Cursor**: Seamlessly attaches workspace paths and project file context.
  - **Developer Terminal**: Grants shell execution authorization and working directory awareness.
  - **Web Browser (Chrome / Firefox / Edge)**: Inspects live URLs, scrapes technical documentation, and parses web content.
  - **File Explorer**: Reads folder trees and manages project assets.
- Live background app detection with visual connection pills in the input toolbar.

### 🤖 Multi-Agent Autonomous Swarm
- Delegate complex workflows to specialized sub-agents:
  - 🧠 **Planner / Architecture Agent**: Decomposes high-level objectives into phased roadmaps.
  - 💻 **Full-Stack Coder Agent**: Writes production-grade components, refactors code, and runs diffs.
  - 🔍 **Research & Intelligence Agent**: Scrapes web docs and inspects codebase patterns.
  - 🛡️ **Quality & Security Reviewer**: Audits proposed changes for safety and edge cases.
  - ⚡ **System & DevOps Agent**: Monitors system diagnostics and shell execution.
- Interactive **Agent Orchestrator Cards** visualizes sub-agent delegations and task outcomes.

### ⚡ Interactive CodeBlock & Direct Runner
- Direct **"Run"** action on code blocks (`bash`, `sh`, `python`, `node`, `powershell`) with inline terminal output drawer showing exit codes, stdout, stderr, and execution duration.
- Automatic interactive line-by-line colored **Diff Viewer** for `diff` and `patch` blocks (emerald for additions, rose for deletions).

### 💻 Developer Terminal Drawer
- Slide-up developer terminal accessible from the top header or via keyboard shortcut **`Ctrl + \``** / **`Cmd + \``**.
- Interactive command history with Up/Down arrow key navigation.

### 🚀 Memory & Performance Optimization
- **Vite Bundle Code-Splitting**: Slashed main bundle from **1,237 kB** down to **475 kB** (-63%), eliminating large chunk warnings and significantly improving initial startup memory.
- **RequestAnimationFrame Streaming**: Batches token streams to 60fps, preventing 50-100 unnecessary React re-renders per second and slashing memory churn during high-speed streaming.

### 📤 Chat Export & Knowledge Management
- One-click export of conversations to clean **Markdown (`.md`)** or structured **JSON (`.json`)** from the chat header.

### 🐧 Linux GPU & WebKitGTK Rendering Fix
- Resolved `KMS: DRM_IOCTL_MODE_CREATE_DUMB failed: Permission denied` and `Failed to create GBM buffer` errors on Linux NVIDIA drivers via `WEBKIT_DISABLE_DMABUF_RENDERER=1`.

---

### Assets & Installation
Download the binary for your operating system below:
- **macOS**: `.dmg` (Apple Silicon & Intel)
- **Linux**: `.AppImage` / `.deb`
- **Windows**: `.exe` / `.msi` installer
