# AgentHub — Local AI Agent Mission Control & Fleet Orchestrator

[![Status](https://img.shields.io/badge/status-active%20%2F%20production%20ready-10b981.svg)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-6366f1.svg)]()
[![License](https://img.shields.io/badge/license-MIT-06b6d4.svg)]()
[![Git Remote](https://img.shields.io/badge/repo-Zeki--wq%2FAgentHub-purple.svg)](https://github.com/Zeki-wq/AgentHub.git)

> **AgentHub is NOT an AI Agent itself.**  
> It is the **Local-First Command Center & Multi-Agent Fleet Orchestrator** designed to discover, supervise, coordinate, and backup every AI coding agent installed on your machine (Claude Code, OpenAI Codex, Aider, Ollama local models, OpenHands, Gemini CLI, Python agent scripts, and custom CLI tools).

---

## 🚀 The 2026 AI Paradigm Shift (HackerNews & YCombinator RFS)

In 2026, software engineers no longer rely on a single isolated chatbot. Developers run a heterogeneous fleet of specialized local AI agents:
- **Claude Code CLI** for high-context repo navigation
- **Codex CLI / App-Server** for workspace sandboxed tasks
- **Aider AI** for rapid terminal pair-programming in git worktrees
- **Ollama / Local LLMs (Llama 3, DeepSeek-Coder)** for 100% offline, privacy-guaranteed code synthesis
- **Autonomous Swarms & Custom Python Agents** for continuous testing and security reviews

### The Problem: Multi-Agent Chaos
Without a centralized local orchestrator:
1. Terminal windows proliferate uncontrollably across monitors.
2. Context and diff tracking become fragmented across multiple git branches.
3. Uncontrolled agents can execute destructive bash commands or overwrite files without human oversight.
4. Token consumption and hardware (CPU/VRAM) exhaust system resources.

### The Solution: AgentHub
AgentHub unifies all installed agents into a **single, stunning mission control cockpit** with:
- 🛰️ **Local Agent Discovery**: Auto-detects installed CLI agents on your OS in 1-click.
- ⚡ **Real-Time Interactive PTY / STDIO Streams**: Live terminal output with direct bidirectional stdin input.
- 🔄 **Continuous Git & Cloud State Checkpointing**: Automated state snapshots with commit sync to [https://github.com/Zeki-wq/AgentHub.git](https://github.com/Zeki-wq/AgentHub.git).
- 🛡️ **Human-in-the-Loop Security Guardrails**: Pre-execution authorization for dangerous terminal commands and file modifications.
- 🧬 **Multi-Agent Swarm Pipelines**: Visual workflow chains (Architect → Coder → Security Auditor → Test Runner → Git Committer).
- 📊 **Live Hardware & Token Telemetry**: Real-time CPU, RAM, and token throughput gauges with estimated cost tracking.
- 🌍 **Bilingual Support (TR / EN)**: Instant 1-click localization for Turkish developers and global tech showcases.

---

## 🛠️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│             AgentHub React 19 Frontend (Vite)            │
│  - Mission Control Dashboard   - Swarm Pipeline Builder  │
│  - Interactive STDIO Terminal  - Git Diff & Sync Center  │
│  - System Telemetry HUD        - English / Turkish i18n  │
└────────────────────────────┬─────────────────────────────┘
                             │ REST & JSON-RPC (Port 4317)
┌────────────────────────────▼─────────────────────────────┐
│                 AgentHub Local Bridge (Node)              │
│  ┌───────────────────────┐    ┌───────────────────────┐  │
│  │   Discovery Engine    │    │    Git Ops & Backup   │  │
│  │  (Scans PATH on OS)   │    │  (Snapshots/Worktrees)│  │
│  └───────────────────────┘    └───────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │                 Provider Adapter Layer             │  │
│  │  ├─ Generic CLI (Claude Code, Aider, Ollama)      │  │
│  │  ├─ Codex App-Server JSON-RPC Protocol             │  │
│  │  └─ Mock / Simulation Provider                     │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────┘
                             │ Local Process Tree Spawning
┌────────────────────────────▼─────────────────────────────┐
│                 Installed AI Agent Fleet                  │
│   claude       codex       aider       ollama      python │
└──────────────────────────────────────────────────────────┘
```

---

## 📦 Quick Start

### 1. Install Dependencies
```powershell
npm.cmd install
```

### 2. Run in Development Mode
```powershell
npm.cmd run dev
```
Open the Vite URL printed in the terminal (default: `http://localhost:5173`). The local bridge starts concurrently on `http://127.0.0.1:4317`.

### 3. Production Build & Run
```powershell
npm.cmd run build
$env:NODE_ENV = 'production'
npm.cmd start
```
AgentHub will serve the production bundle on `http://127.0.0.1:4317`.

---

## 🌟 Key Features

### 1. 🔍 Local AI Agent Scanner
AgentHub automatically scans your system `PATH` and user profile directories for:
- `claude` (Anthropic Claude Code CLI)
- `codex` (OpenAI Codex CLI app-server)
- `aider` (Aider AI Pair Programmer)
- `ollama` (Ollama Local LLM server)
- `openhands` (Autonomous Software Engineer)
- `gemini` (Google Gemini CLI)
- `python` / `node` / `docker` / `git`

### 2. 🛡️ Human-in-the-Loop Approval Center
When an agent attempts to execute a shell command flagged as potentially destructive or writes to protected directories, AgentHub pauses the agent and requests human authorization in the Approvals queue.

### 3. 🔄 Continuous Git Snapshots & Backup
- Auto-snapshot after every task completion.
- Periodic 10-minute checkpoint backups.
- One-click instant manual commit creation.
- Seamless remote syncing with `https://github.com/Zeki-wq/AgentHub.git`.

### 4. 🧬 Multi-Agent Swarm Pipelines
Chain multiple agents into structured workflows:
1. **Spec Architecture**: Analyzes AST tree and drafts interface contracts.
2. **Implementation**: Generates code and unit tests.
3. **Security Audit**: Scans for vulnerabilities and permission boundaries.
4. **Regression Testing**: Runs test suite to verify 100% pass rate.
5. **Git Auto-Committer**: Stages and commits signed worktree snapshot.

---

## 🔒 Security & Privacy
AgentHub is **100% local-first**. Your code, logs, and workspace files are never transmitted to external third-party cloud servers unless you explicitly trigger a Git push to your configured remote repository.
