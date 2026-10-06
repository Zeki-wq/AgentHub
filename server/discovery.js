import { execFile, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TOOLS = [
  {
    id: 'claude',
    name: 'Claude Code CLI',
    category: 'Coding Agent',
    icon: 'Bot',
    executables: ['claude', 'claude.cmd', 'claude.exe'],
    versionFlag: ['--version'],
    docsUrl: 'https://docs.anthropic.com/en/docs/agents-and-tools/claude-code',
    defaultArgs: ['--non-interactive'],
    description: 'Anthropic agentic CLI for codebase navigation, edits, and terminal workflows.',
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    category: 'App-Server Agent',
    icon: 'Terminal',
    executables: ['codex', 'codex.cmd', 'codex.exe'],
    versionFlag: ['--version'],
    docsUrl: 'https://github.com/openai/codex',
    defaultArgs: ['app-server', '--listen', 'stdio://'],
    description: 'OpenAI Codex local server with workspace sandbox and human approval bridge.',
  },
  {
    id: 'aider',
    name: 'Aider AI',
    category: 'Pair Programmer',
    icon: 'Bot',
    executables: ['aider', 'aider.exe'],
    versionFlag: ['--version'],
    docsUrl: 'https://aider.chat',
    defaultArgs: ['--no-auto-commits', '--yes'],
    description: 'Autonomous AI pair programming in your terminal, with git worktree support.',
  },
  {
    id: 'ollama',
    name: 'Ollama Local LLM',
    category: 'Local Inference Runtime',
    icon: 'Cpu',
    executables: ['ollama', 'ollama.exe'],
    versionFlag: ['--version'],
    docsUrl: 'https://ollama.com',
    defaultArgs: ['run', 'llama3:latest'],
    description: 'Run local LLMs (Llama 3, DeepSeek-Coder, Mistral, Qwen) 100% offline on your hardware.',
  },
  {
    id: 'openhands',
    name: 'OpenHands (All-Hands)',
    category: 'Autonomous Software Agent',
    icon: 'Bot',
    executables: ['openhands', 'all-hands', 'openhands.exe'],
    versionFlag: ['--version'],
    docsUrl: 'https://github.com/All-Hands-AI/OpenHands',
    defaultArgs: [],
    description: 'Open-source autonomous AI software engineer capable of complex web & backend development.',
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    category: 'Developer Agent',
    icon: 'Bot',
    executables: ['gemini', 'gemini.cmd'],
    versionFlag: ['--version'],
    docsUrl: 'https://ai.google.dev',
    defaultArgs: [],
    description: 'Google Gemini developer agent CLI for multi-modal reasoning and repo analysis.',
  },
  {
    id: 'python',
    name: 'Python Agent Environment',
    category: 'Scripting Runtime',
    icon: 'Terminal',
    executables: ['python', 'python3', 'python.exe', 'py'],
    versionFlag: ['--version'],
    docsUrl: 'https://python.org',
    defaultArgs: [],
    description: 'Supports local LangChain, CrewAI, AutoGPT, and custom agent Python scripts.',
  },
  {
    id: 'node',
    name: 'Node.js / NPX',
    category: 'JavaScript Runtime',
    icon: 'Terminal',
    executables: ['node', 'node.exe'],
    versionFlag: ['--version'],
    docsUrl: 'https://nodejs.org',
    defaultArgs: [],
    description: 'JavaScript agent runtime and NPX package executor.',
  },
  {
    id: 'git',
    name: 'Git Version Control',
    category: 'System Core',
    icon: 'GitBranch',
    executables: ['git', 'git.exe'],
    versionFlag: ['--version'],
    docsUrl: 'https://git-scm.com',
    defaultArgs: [],
    description: 'Core revision control and continuous snapshot/backup engine for AgentHub.',
  },
  {
    id: 'docker',
    name: 'Docker Desktop / Engine',
    category: 'Container Sandbox',
    icon: 'Cpu',
    executables: ['docker', 'docker.exe'],
    versionFlag: ['--version'],
    docsUrl: 'https://docker.com',
    defaultArgs: [],
    description: 'Isolated container environment for running untrusted autonomous agent workloads.',
  },
];

function findExecutable(names) {
  const isWin = process.platform === 'win32';
  const pathExts = isWin ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';') : [''];
  const pathDirs = (process.env.PATH || '').split(path.delimiter);

  // Add common user installation paths for Windows and Unix
  if (isWin) {
    const userProfile = process.env.USERPROFILE || '';
    const appData = process.env.APPDATA || '';
    const localAppData = process.env.LOCALAPPDATA || '';
    pathDirs.push(
      path.join(appData, 'npm'),
      path.join(localAppData, 'Programs', 'Ollama'),
      path.join(userProfile, '.cargo', 'bin'),
      path.join(userProfile, '.local', 'bin'),
      path.join(localAppData, 'Programs', 'Python', 'Python311', 'Scripts'),
      path.join(localAppData, 'Programs', 'Python', 'Python312', 'Scripts'),
      'C:\\Program Files\\Git\\cmd',
      'C:\\Program Files\\Docker\\Docker\\resources\\bin'
    );
  } else {
    const home = os.homedir();
    pathDirs.push(
      path.join(home, '.local', 'bin'),
      path.join(home, '.cargo', 'bin'),
      path.join(home, '.npm-global', 'bin'),
      '/usr/local/bin',
      '/opt/homebrew/bin'
    );
  }

  for (const name of names) {
    for (const dir of pathDirs) {
      if (!dir) continue;
      for (const ext of pathExts) {
        const full = path.join(dir, name.endsWith(ext) ? name : `${name}${ext}`);
        try {
          if (fs.existsSync(full) && fs.statSync(full).isFile()) {
            return full;
          }
        } catch {}
      }
    }
  }
  return null;
}

function getToolVersion(binPath, versionFlags) {
  if (!binPath) return null;
  try {
    const isWin = process.platform === 'win32';
    const out = execSync(`"${binPath}" ${versionFlags.join(' ')}`, {
      timeout: 2500,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWin,
    });
    return out.trim().split('\n')[0] || 'Unknown version';
  } catch (err) {
    return 'Installed (version check timed out)';
  }
}

export async function scanInstalledAgents() {
  const results = [];
  for (const tool of TOOLS) {
    const binPath = findExecutable(tool.executables);
    const isAvailable = Boolean(binPath);
    let version = null;
    if (isAvailable) {
      version = getToolVersion(binPath, tool.versionFlag);
    }
    results.push({
      id: tool.id,
      name: tool.name,
      category: tool.category,
      icon: tool.icon,
      available: isAvailable,
      binPath: binPath || null,
      version: version || (isAvailable ? 'Installed' : 'Not detected'),
      defaultArgs: tool.defaultArgs,
      docsUrl: tool.docsUrl,
      description: tool.description,
    });
  }
  return results;
}
