# Contributing to ChatMe 🤖

Thank you for your interest in contributing to ChatMe! We welcome contributions from developers of all skill levels.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)
- [Rust & Cargo](https://rustup.rs/) (stable toolchain)
- Platform-specific Tauri prerequisites (see [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/))

### Setting Up Development Environment

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/ChatMe.git
   cd ChatMe
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Run the web development server:**
   ```bash
   npm run dev
   ```

4. **Run in Tauri Desktop mode:**
   ```bash
   npm run tauri:dev
   ```

## Development Workflow

### Branching Convention
Create a feature branch off `main` for your work:
- Features: `feature/<feature-name>`
- Bugfixes: `fix/<bug-description>`
- Documentation: `docs/<topic>`
- Chore/Refactor: `chore/<description>`

```bash
git checkout -b feature/awesome-feature
```

### Commit Guidelines
We recommend clear and concise commit messages:
- `feat: add Ollama custom port configuration`
- `fix: resolve speech recognition audio clipping`
- `docs: update API key configuration guide`

### Pull Request Process
1. Ensure your code builds without errors:
   ```bash
   npm run build
   ```
2. Open a Pull Request pointing to `main`.
3. Complete the PR template with clear context and test results.
4. A maintainer will review your pull request.

## Release Process (For Maintainers)

Releases are automated via GitHub Actions:
1. Version bumps update `package.json`, `Cargo.toml`, and `tauri.conf.json`:
   ```bash
   npm run version:patch   # or minor/major
   ```
2. Document new changes in `RELEASE_NOTES.md` and archive them to `release_notes/v<version>.md`.
3. Push a tag matching `app-v*` or `v*`:
   ```bash
   git tag app-v0.X.Y
   git push origin app-v0.X.Y
   ```
4. The GitHub Action will automatically compile artifacts for Windows, macOS, and Linux, and publish a draft release with the release notes.
