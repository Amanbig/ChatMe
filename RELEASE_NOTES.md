# ChatMe v0.5.3 Release Notes

## 🚀 What's New in v0.5.3

### ⚡ Hybrid Architecture
- Rust backend now securely handles external HTTP requests, completely bypassing browser CORS restrictions.
- Dramatically improved network reliability and streaming throughput.

### 🌐 13 AI Providers
- Out-of-the-box support for:
  - **OpenAI** (GPT-4o, GPT-4 Turbo, GPT-3.5)
  - **Anthropic Claude** (Claude 3.5 Sonnet, Claude 3 Opus, Haiku)
  - **Google Gemini** (Gemini 1.5 Pro, Gemini 1.5 Flash)
  - **Local Models**: Ollama & LMStudio
  - **Fast & Open Providers**: Groq, Together AI, Mistral AI, DeepSeek, OpenRouter, Kimi, Perplexity
  - **Custom Endpoints**: Any OpenAI-compatible server

### 📡 Native Streaming
- Provider-tailored streaming pipelines for OpenAI, Anthropic, and Google with minimal latency.

### 🔌 Model Context Protocol (MCP) Support
- Seamless connection to local and remote MCP servers.
- Dynamic tool discovery and execution.

### 🛡️ Enhanced Permissions & Safety
- Granular permission prompts before running shell commands or modifying files.
- Improved control over tool execution privileges.

### 🎨 UI & UX Refinements
- Polished starter prompt cards and home screen transitions.
- Improved message deletion with confirmation flow.
- Smoother mobile and responsive window adjustments.

---

### Assets & Installation
Download the binary for your operating system below:
- **macOS**: `.dmg` (Apple Silicon & Intel)
- **Linux**: `.AppImage` / `.deb`
- **Windows**: `.exe` / `.msi` installer
