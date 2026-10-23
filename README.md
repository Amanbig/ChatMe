<div align="center">

# ChatMe 🤖
### The Open-Source, Multi-Agent Desktop AI with System Access, App Integrations & Auto-Updater

[![GitHub Release](https://img.shields.io/github/v/release/Amanbig/ChatMe?color=38bdf8&style=for-the-badge&logo=github)](https://github.com/Amanbig/ChatMe/releases)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2.10-24C8D8?style=for-the-badge&logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![React 19](https://img.shields.io/badge/React-v19.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Rust](https://img.shields.io/badge/Rust-Stable-DEA584?style=for-the-badge&logo=rust&logoColor=black)](https://www.rust-lang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=for-the-badge)](CONTRIBUTING.md)

<p align="center">
  <b>ChatMe</b> is a fast, privacy-first desktop application combining <b>multi-agent autonomous workflows</b>, <b>ChatGPT Desktop-style app connections</b>, <b>direct code execution</b>, <b>built-in auto-updates with authorization</b>, and <b>voice interaction</b> powered by 13+ cloud and local AI providers.
</p>

[Download Latest Release](https://github.com/Amanbig/ChatMe/releases) • [Features](#-core-features) • [Architecture](#-architecture) • [Getting Started](#-getting-started) • [Contributing](CONTRIBUTING.md)

<br/>

<table align="center">
  <tr>
    <td align="center">
      <img src="images/light.png" alt="ChatMe Light Theme" width="440"/>
      <br/><sub><b>Light Mode</b></sub>
    </td>
    <td align="center">
      <img src="images/dark.png" alt="ChatMe Dark Theme" width="440"/>
      <br/><sub><b>Dark Mode</b></sub>
    </td>
  </tr>
</table>

</div>

---

## ⚡ What Sets ChatMe Apart?

| Feature | ChatMe (Open Source) | ChatGPT Desktop | Claude Desktop |
| :--- | :---: | :---: | :---: |
| **Local Offline Models (Ollama, LMStudio)** | ✅ Native | ❌ Cloud only | ❌ Cloud only |
| **Multi-Provider Ecosystem (13+ APIs)** | ✅ Universal | ❌ OpenAI only | ❌ Anthropic only |
| **"Work with Apps" Context Attachment** | ✅ VS Code, Terminal, Browser | ✅ Limited apps | ❌ None |
| **Autonomous Multi-Agent Swarm** | ✅ Planner, Coder, Reviewer, etc. | ❌ Single agent | ❌ Single agent |
| **Interactive In-Chat Code Runner** | ✅ Direct Run (Bash, Python, Node) | ❌ Read-only | ❌ Read-only |
| **System Terminal with GUI Editor Fallback** | ✅ Authentic stream + GUI launch | ❌ None | ❌ None |
| **Native Internal Auto-Updater** | ✅ Cross-Platform (`pkexec`, UAC, AppleScript) | ❌ Proprietary | ❌ Proprietary |
| **Built-in DuckDuckGo Search Engine** | ✅ Zero-config web search | ❌ Restricted | ❌ None |
| **Model Context Protocol (MCP)** | ✅ First-class client | ❌ None | ✅ Supported |
| **Full Data Ownership (Local SQLite)** | ✅ 100% On-Device | ❌ Cloud hosted | ❌ Cloud hosted |

---

## 🌟 Core Features

### 🔄 1. Native Cross-Platform Auto-Updater
- **In-App Updating**: Checks GitHub releases automatically, compares semantic versions, and downloads the exact package matching your OS and architecture (`.deb`, `.AppImage`, `.dmg`, `.exe`).
- **Native Privilege Authorization**:
  - **Linux (`.deb` / `.rpm`)**: Executes through Polkit (`pkexec`) displaying the native GUI password prompt.
  - **Linux (AppImage)**: Applies `chmod +x` and safely replaces the active AppImage in-place.
  - **macOS (`.dmg`)**: Mounts the image and updates `/Applications/ChatMe.app` with AppleScript administrator credentials.
  - **Windows (`.exe` / `.msi`)**: Runs elevated installers with Windows UAC prompt.
- **Streaming Progress & One-Click Restart**: Displays live download progress and provides an instant "Restart Application" button upon installation.

### 🖥️ 2. "Work with Apps" (ChatGPT Desktop Style)
- Connect ChatMe with running applications on your computer:
  - **VS Code & Cursor**: Injects active workspace directory, file hierarchy, and editing context.
  - **Developer Terminal**: Grants shell authorization and directory awareness.
  - **Web Browsers**: Reads external URLs, parses web documentation, and inspects APIs.
  - **File Explorer**: Analyzes directory trees and project assets.
- Live background app detection with visual connection pills in the input toolbar.

### 🤖 3. Multi-Agent Autonomous Swarm
- Direct queries to specialized sub-agents or let the **Autonomous Swarm** self-coordinate:
  - 🧠 **Architecture & Planning Agent**: Breaks complex goals into milestone roadmaps.
  - 💻 **Full-Stack Engineering Agent**: Writes code, modifies files, and creates diffs.
  - 🔍 **Research & Web Intelligence Agent**: Scrapes web docs and inspects codebase patterns.
  - 🛡️ **Security & Quality Reviewer**: Audits proposed changes for safety and edge cases.
  - ⚡ **DevOps & System Operator**: Executes shell commands and monitors diagnostics.
- Interactive **Agent Orchestrator Cards** display real-time sub-task progression.

### 💻 4. System Line-Wise Terminal Drawer
- Press **`Ctrl + \``** (or **`Cmd + \``**) or click **Terminal** in the top navigation bar to toggle the integrated terminal.
- **Authentic Linewise Streaming**: Real-time terminal output stream just like your system shell.
- **GUI Editor Interceptor**: Shell commands like `vim`, `nano`, `vi`, `emacs`, `edit`, and `open` automatically open files in your desktop editor rather than freezing background processes.
- **Global `Ctrl+C` Interrupt**: Immediately cancel running commands.

### 🌐 5. Built-in DuckDuckGo Web Search
- Direct, zero-config web search functionality allowing the AI and agents to look up live documentation, APIs, and current events without requiring third-party search API keys.

### ⚡ 6. Interactive CodeBlock Runner & Diff Viewer
- Direct **"Run"** action on code blocks (`bash`, `sh`, `zsh`, `python`, `node`) with inline execution drawers displaying exit codes, stdout, stderr, and run duration.
- Automatic line-by-line colored **Diff Viewer** for `diff` and `patch` blocks.

### 🎨 7. Appearance & Google Fonts Typography
- Real-time typography engine with popular developer fonts: *Inter*, *Roboto*, *Open Sans*, *JetBrains Mono*, *Fira Code*, *Outfit*, and more.
- Dynamic font scaling with instant UI preview.

### 🔊 8. Native Cross-Platform Speech (TTS)
- Dedicated native speech backend for each platform:
  - **Linux**: `spd-say` (Speech Dispatcher)
  - **macOS**: `say` (Apple Speech Synthesis)
  - **Windows**: SAPI via PowerShell `System.Speech`
- Speech-to-Text (STT) voice input with natural dictation.

### ☁️ 9. 13+ Cloud & Local AI Providers
- **Cloud Providers**: OpenAI (GPT-4o), Anthropic Claude (3.5 Sonnet), Google Gemini (1.5 Pro), DeepSeek, Groq, Mistral AI, OpenRouter, Together AI, Kimi, Perplexity.
- **Local & Offline**: Ollama, LMStudio, and custom OpenAI-compatible endpoints.
- **Native Streaming**: Rust backend delivers ultra-low latency chunked streaming without CORS limitations.

### 📤 10. One-Click Chat Exporter
- Export conversations to clean **Markdown (`.md`)** or structured **JSON (`.json`)** with one click directly from the chat header.

---

## 🏛️ Architecture

ChatMe pairs a high-performance **Rust backend** (using Tauri v2) with a **React 19 + Tailwind v4** client:

```mermaid
flowchart TD
    subgraph Frontend["Frontend Client (React 19 + TypeScript)"]
        UI["Modern Chat Canvas"]
        ToolsBar["Work with Apps & Sub-Agent Selector"]
        Terminal["Line-Wise Developer Terminal"]
        Runner["CodeBlock Runner & Diff Viewer"]
        UpdaterUI["In-App Auto-Updater Interface"]
    end

    subgraph IPC["Tauri v2 IPC Bridge"]
        Commands["Rust Command Invocations"]
        Events["Real-Time Streaming, Progress & Events"]
    end

    subgraph Backend["Native Rust Backend"]
        HTTP["CORS-Free HTTP Engine (reqwest + tokio)"]
        UpdaterEngine["Auto-Updater with pkexec / UAC / osascript"]
        DDG["Built-in DuckDuckGo Search"]
        TTS["Native TTS Engine (spd-say / say / SAPI)"]
        AgentCore["Agentic Session & Tool Executor"]
        DB["Local SQLite Storage (sqlx)"]
        SysOps["Shell, Process & File Operations"]
        MCP["Model Context Protocol Client"]
    end

    UI --> Commands
    ToolsBar --> Commands
    Terminal --> Commands
    Runner --> Commands
    UpdaterUI --> Commands
    Commands --> AgentCore
    Commands --> UpdaterEngine
    Commands --> DDG
    Commands --> TTS
    Commands --> HTTP
    Commands --> DB
    AgentCore --> SysOps
    AgentCore --> MCP
    Events -.-> UI
    Events -.-> UpdaterUI
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)
- [Rust & Cargo](https://rustup.rs/) (stable toolchain)
- Platform-specific Tauri prerequisites (see [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/))

### Installation & Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Amanbig/ChatMe.git
   cd ChatMe
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start in Web Development mode:**
   ```bash
   npm run dev
   ```

4. **Run as Desktop App (Tauri):**
   ```bash
   npm run tauri:dev
   ```

### Building Release Binaries

To compile native release binaries for your operating system:
```bash
npm run tauri:build
```
Artifacts will be output to `src-tauri/target/release/bundle/`.

---

## 🤝 Contributing

We welcome contributions from developers worldwide! Whether fixing bugs, adding new sub-agent personas, or improving UI responsiveness:

1. Check out our [Contributing Guidelines](CONTRIBUTING.md).
2. Adhere to the [Code of Conduct](CODE_OF_CONDUCT.md).
3. Report bugs or suggest features using our [Issue Templates](.github/ISSUE_TEMPLATE/).
4. Open a Pull Request following our [PR Template](.github/pull_request_template.md).

---

## 🛡️ Security

ChatMe takes user privacy and local machine execution seriously. For vulnerability reporting, please review our [Security Policy](SECURITY.md).

---

## 📄 License

This project is open-source under the [Apache-2.0 License](LICENSE).
