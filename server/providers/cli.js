import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { AgentProvider } from './types.js';

const MAX_LOGS = 200;

export class CliAgentProvider extends AgentProvider {
  constructor(store) {
    super('cli');
    this.store = store;
    this.processes = new Map();
  }

  async list() {
    return this.store.agents.filter((a) => a.provider === 'cli');
  }

  async start(id, { confirmed = false } = {}) {
    const agent = this.store.agents.find((a) => a.id === id);
    if (!agent) throw new Error('Agent not found');
    if (this.processes.has(id)) throw new Error('Agent process is already running');

    const cwd = agent.workspace && fs.existsSync(agent.workspace) ? agent.workspace : process.cwd();
    const command = agent.cliConfig?.command || 'claude';
    const args = agent.cliConfig?.args || [];

    let child;
    try {
      const isWin = process.platform === 'win32';
      child = spawn(command, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        shell: isWin,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          FORCE_COLOR: '1',
          ...(agent.cliConfig?.env || {}),
        },
      });
    } catch (err) {
      this.store.updateAgent(id, { status: 'error', lastActivity: new Date().toISOString() }, `Spawn error: ${err.message}`);
      throw new Error(`Failed to spawn CLI process: ${err.message}`);
    }

    const session = {
      id,
      child,
      pid: child.pid,
      cwd,
      startedAt: Date.now(),
    };
    this.processes.set(id, session);

    this.store.updateAgent(id, {
      status: 'working',
      processId: child.pid,
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    }, `CLI process started (PID: ${child.pid}, ${command} in ${cwd})`);

    const appendLog = (message, source = 'stdout') => {
      const log = {
        id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        at: new Date().toISOString(),
        message: message.replace(/\r/g, ''),
        level: source === 'stderr' ? 'error' : 'info',
        source,
      };
      const curAgent = this.store.agents.find((a) => a.id === id);
      if (curAgent) {
        curAgent.logs = [log, ...(curAgent.logs || [])].slice(0, MAX_LOGS);
        curAgent.lastActivity = new Date().toISOString();
      }
    };

    child.stdout.on('data', (data) => {
      const text = data.toString('utf8');
      const lines = text.split('\n').filter(Boolean);
      for (const line of lines) {
        appendLog(line, 'stdout');
      }
    });

    child.stderr.on('data', (data) => {
      const text = data.toString('utf8');
      const lines = text.split('\n').filter(Boolean);
      for (const line of lines) {
        appendLog(line, 'stderr');
      }
    });

    child.on('error', (err) => {
      appendLog(`Process error: ${err.message}`, 'stderr');
      this.processes.delete(id);
      this.store.updateAgent(id, { status: 'error', processId: null, lastActivity: new Date().toISOString() }, `CLI error: ${err.message}`);
    });

    child.on('exit', (code, signal) => {
      appendLog(`Process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`, 'info');
      this.processes.delete(id);
      this.store.updateAgent(id, {
        status: code === 0 ? 'done' : 'stopped',
        processId: null,
        lastActivity: new Date().toISOString(),
      }, `CLI process terminated with code ${code}`);
    });

    return this.store.agents.find((a) => a.id === id);
  }

  async stop(id, { confirmed = false } = {}) {
    const session = this.processes.get(id);
    if (!session) {
      this.store.updateAgent(id, { status: 'stopped', processId: null, lastActivity: new Date().toISOString() }, 'Process not running');
      return this.store.agents.find((a) => a.id === id);
    }

    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${session.pid} /T /F`, { stdio: 'ignore' });
      } else {
        process.kill(-session.pid, 'SIGKILL');
      }
    } catch {
      try {
        session.child.kill('SIGKILL');
      } catch {}
    }

    this.processes.delete(id);
    return this.store.updateAgent(id, {
      status: 'stopped',
      processId: null,
      lastActivity: new Date().toISOString(),
    }, 'Agent process stopped by user');
  }

  async assignTask(id, task, { confirmed = false } = {}) {
    if (!task?.trim()) throw new Error('Task description is required');
    const session = this.processes.get(id);

    if (session && session.child.stdin.writable) {
      session.child.stdin.write(`${task.trim()}\n`);
      const log = {
        id: `l-${Date.now()}`,
        at: new Date().toISOString(),
        message: `> ${task.trim()}`,
        level: 'info',
        source: 'stdin',
      };
      const curAgent = this.store.agents.find((a) => a.id === id);
      if (curAgent) {
        curAgent.logs = [log, ...(curAgent.logs || [])].slice(0, MAX_LOGS);
        curAgent.currentTask = task.trim();
        curAgent.status = 'working';
        curAgent.lastActivity = new Date().toISOString();
      }
      return curAgent;
    }

    // If not running, update state
    return this.store.updateAgent(id, {
      currentTask: task.trim(),
      status: 'idle',
      lastActivity: new Date().toISOString(),
    }, `Task assigned: ${task.trim()}`);
  }

  async sendStdin(id, input) {
    const session = this.processes.get(id);
    if (!session || !session.child.stdin.writable) {
      throw new Error('Agent process is not running or stdin is closed');
    }
    session.child.stdin.write(`${input}\n`);
    const log = {
      id: `l-${Date.now()}`,
      at: new Date().toISOString(),
      message: `> ${input}`,
      level: 'info',
      source: 'stdin',
    };
    const curAgent = this.store.agents.find((a) => a.id === id);
    if (curAgent) {
      curAgent.logs = [log, ...(curAgent.logs || [])].slice(0, MAX_LOGS);
    }
    return { ok: true };
  }

  async setStatus(id, status) {
    const allowed = ['idle', 'working', 'waiting', 'done', 'error', 'stopped'];
    if (!allowed.includes(status)) throw new Error('Unsupported agent status');
    return this.store.updateAgent(id, { status, lastActivity: new Date().toISOString() }, `Status set to ${status}`);
  }
}
