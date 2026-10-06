import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { AgentProvider } from './types.js';

const MAX_LOGS = 150;
const allowedStatuses = new Set(['idle', 'working', 'waiting', 'done', 'error', 'stopped']);

/** Owns one Codex app-server process and its JSON-RPC session per Codex agent. */
export class CodexAgentProvider extends AgentProvider {
  constructor(store) {
    super('codex');
    this.store = store;
    this.sessions = new Map();
    this.executable = process.env.CODEX_CLI_PATH || this.#findCli();
    this.available = Boolean(this.executable); // A missing CLI never affects mock agents.
    for (const agent of this.store.agents.filter((item) => item.provider === 'codex' && item.processId)) {
      this.store.updateAgent(agent.id, { status: 'error', processId: null, approvals: [], lastActivity: new Date().toISOString() }, 'AgentHub restarted; the previous Codex process is no longer attached. Start a new session.');
    }
  }

  async list() { return this.store.agents.filter((agent) => agent.provider === 'codex'); }

  async start(id, { confirmed = false } = {}) {
    if (!confirmed) throw new Error('Confirm before starting a Codex process.');
    const agent = this.#getAgent(id);
    if (!this.executable) {
      const error = new Error('Codex CLI was not found. Install it or set CODEX_CLI_PATH, then restart AgentHub.');
      this.store.updateAgent(id, { status: 'error', lastActivity: new Date().toISOString() }, error.message);
      throw error;
    }
    if (this.sessions.has(id)) throw new Error('This Codex process is already running.');
    let cwd;
    try { cwd = this.#validatedWorkspace(agent.workspace); }
    catch (error) {
      this.store.updateAgent(id, { status: 'error', lastActivity: new Date().toISOString() }, `Workspace check failed: ${error.message}`);
      throw error;
    }
    const child = spawn(this.executable, ['app-server', '--listen', 'stdio://'], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(this.executable),
      env: { ...process.env },
    });
    const session = { child, id, cwd, buffer: '', nextId: 1, pending: new Map(), approvals: new Map(), stopping: false, threadId: null };
    this.sessions.set(id, session);
    this.#wireSession(session);

    try {
      const result = await this.#rpc(session, 'initialize', {
        clientInfo: { name: 'agenthub', title: 'AgentHub', version: '0.1.0' },
        capabilities: { experimentalApi: true },
      });
      this.#notify(session, 'initialized', {});
      const thread = await this.#rpc(session, 'thread/start', {
        cwd,
        approvalPolicy: 'on-request',
        sandbox: 'workspaceWrite',
      });
      session.threadId = thread?.thread?.id || thread?.id;
      if (!session.threadId) throw new Error('Codex app-server did not return a thread id.');
      this.store.updateAgent(id, {
        status: 'idle',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        threadId: session.threadId,
        processId: child.pid,
        approvals: [],
      }, `Codex process started in ${cwd}`);
      return this.#getAgent(id);
    } catch (error) {
      this.#appendLog(id, `Could not start Codex: ${error.message}`, 'stderr');
      session.stopping = true;
      this.#killTree(child);
      this.sessions.delete(id);
      this.store.updateAgent(id, { status: 'error', lastActivity: new Date().toISOString() }, `Codex startup failed: ${error.message}`);
      throw new Error(`Codex could not start: ${error.message}`);
    }
  }

  async stop(id, { confirmed = false } = {}) {
    if (!confirmed) throw new Error('Confirm before stopping a Codex process.');
    const session = this.sessions.get(id);
    if (!session) {
      this.store.updateAgent(id, { status: 'stopped', lastActivity: new Date().toISOString() }, 'Codex process is not running');
      return this.#getAgent(id);
    }
    session.stopping = true;
    for (const [requestId] of session.approvals) this.#respond(session, requestId, { decision: 'decline' });
    this.sessions.delete(id);
    await this.#killTree(session.child);
    this.store.updateAgent(id, { status: 'stopped', processId: null, approvals: [], lastActivity: new Date().toISOString() }, 'Codex process stopped by user');
    return this.#getAgent(id);
  }

  async setStatus(id, status) {
    if (!allowedStatuses.has(status)) throw new Error('Unsupported agent status');
    throw new Error('Codex status is controlled by its process. Use Start, Stop, or respond to a pending approval.');
  }

  async shutdown() {
    const sessions = [...this.sessions.values()];
    for (const session of sessions) {
      session.stopping = true;
      this.sessions.delete(session.id);
      await this.#killTree(session.child);
      this.store.updateAgent(session.id, { status: 'stopped', processId: null, approvals: [], lastActivity: new Date().toISOString() }, 'AgentHub stopped the Codex process during shutdown');
    }
  }

  async assignTask(id, task, { confirmed = false } = {}) {
    if (!confirmed) throw new Error('Confirm before sending a task to Codex.');
    if (typeof task !== 'string' || !task.trim()) throw new Error('Task description is required');
    const session = this.sessions.get(id);
    if (!session?.threadId) throw new Error('Start the Codex agent before sending it a task.');
    this.store.updateAgent(id, {
      currentTask: task.trim(), status: 'working', progress: 0,
      lastActivity: new Date().toISOString(), approvals: [],
    }, `Task sent to Codex: ${task.trim()}`);
    try {
      await this.#rpc(session, 'turn/start', {
        threadId: session.threadId,
        input: [{ type: 'text', text: task.trim() }],
        approvalPolicy: 'on-request',
        sandbox: 'workspaceWrite',
      });
    } catch (error) {
      this.#appendLog(id, `Could not send task: ${error.message}`, 'stderr');
      this.store.updateAgent(id, { status: 'error', lastActivity: new Date().toISOString() }, `Codex task failed: ${error.message}`);
      throw error;
    }
    return this.#getAgent(id);
  }

  async respondToApproval(id, requestId, decision) {
    if (!['accept', 'decline'].includes(decision)) throw new Error('Approval decision must be accept or decline.');
    const session = this.sessions.get(id);
    const entry = session && [...session.approvals].find(([pendingId]) => String(pendingId) === String(requestId));
    if (!entry) throw new Error('Approval request is no longer pending.');
    const [protocolId, approval] = entry;
    session.approvals.delete(protocolId);
    this.#respond(session, protocolId, { decision });
    const agent = this.#getAgent(id);
    const approvals = (agent.approvals || []).filter((item) => item.requestId !== requestId);
    this.store.updateAgent(id, { approvals, status: approvals.length ? 'waiting' : 'working', lastActivity: new Date().toISOString() }, `User ${decision === 'accept' ? 'approved' : 'rejected'}: ${approval.summary}`);
    return this.#getAgent(id);
  }

  #wireSession(session) {
    const { child, id } = session;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => this.#consume(session, chunk));
    child.stderr.on('data', (chunk) => {
      for (const line of chunk.split(/\r?\n/).filter(Boolean)) this.#appendLog(id, line, 'stderr');
    });
    child.on('error', (error) => {
      if (!session.stopping) this.#fail(session, `Codex process error: ${error.message}`);
    });
    child.on('close', (code, signal) => {
      for (const [requestId, pending] of session.pending) { clearTimeout(pending.timer); pending.reject(new Error('Codex process exited.')); }
      session.pending.clear();
      if (this.sessions.get(id) === session) this.sessions.delete(id);
      if (session.stopping) return;
      const message = `Codex process exited (code ${code ?? 'unknown'}${signal ? `, ${signal}` : ''}).`;
      this.#appendLog(id, message, code === 0 ? 'stdout' : 'stderr');
      this.store.updateAgent(id, { status: code === 0 ? 'done' : 'error', processId: null, approvals: [], lastActivity: new Date().toISOString() }, message);
    });
  }

  #consume(session, chunk) {
    session.buffer += chunk;
    const lines = session.buffer.split(/\r?\n/);
    session.buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try { this.#handleMessage(session, JSON.parse(line)); }
      catch (error) { this.#appendLog(session.id, `Codex stdout: ${line}`, 'stdout'); }
    }
  }

  #handleMessage(session, message) {
    if (Object.hasOwn(message, 'id') && session.pending.has(message.id)) {
      const pending = session.pending.get(message.id);
      session.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message || 'Codex app-server request failed.'));
      else pending.resolve(message.result || {});
      return;
    }
    if (Object.hasOwn(message, 'id') && message.method) {
      const approvalMethod = /requestApproval$/.test(message.method);
      if (approvalMethod) {
        const summary = message.params?.reason || message.params?.command || message.params?.title || 'Codex requests approval for an operation';
        session.approvals.set(message.id, { summary, method: message.method });
        const agent = this.#getAgent(session.id);
        const approvals = [...(agent.approvals || []), { requestId: message.id, method: message.method, summary }];
        this.store.updateAgent(session.id, { status: 'waiting', approvals, lastActivity: new Date().toISOString() }, `Waiting for approval: ${summary}`);
        return;
      }
      this.#respond(session, message.id, { error: { code: -32601, message: 'Method not supported by AgentHub.' } });
      return;
    }
    const method = message.method;
    const params = message.params || {};
    const type = params.msg?.type || params.item?.type || '';
    const delta = params.delta ?? params.outputDelta ?? '';
    if (/turn\/started/.test(method || '')) {
      this.#setStatus(session.id, 'working', 'Codex started working');
    } else if (/turn\/completed/.test(method || '')) {
      const status = params.turn?.status;
      const next = status === 'completed' ? 'done' : status === 'interrupted' ? 'stopped' : 'error';
      this.#setStatus(session.id, next, `Codex turn ${status || 'ended'}`);
    } else if (/agentMessage\/delta|outputDelta|commandExecution\/outputDelta|commandExecution\/terminalInteraction/i.test(`${method || ''} ${type}`) && delta) {
      this.#appendLog(session.id, String(delta), 'stdout');
    } else if (/(fileChange|commandExecution|reasoning|item\/completed)/i.test(`${method || ''} ${type}`)) {
      const body = params.command || params.item?.command || params.item?.text || params.text || params.reason || method;
      if (body) this.#appendLog(session.id, String(body), 'stdout');
    }
  }

  #rpc(session, method, params) {
    const id = session.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { session.pending.delete(id); reject(new Error(`Timed out waiting for ${method}.`)); }, 20000);
      session.pending.set(id, { resolve, reject, timer });
      try { session.child.stdin.write(`${JSON.stringify({ id, method, params })}\n`); }
      catch (error) { clearTimeout(timer); session.pending.delete(id); reject(error); }
    });
  }

  #notify(session, method, params) {
    session.child.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  #respond(session, id, result) {
    try { session.child.stdin.write(`${JSON.stringify({ id, result })}\n`); }
    catch (error) { this.#appendLog(session.id, `Could not send approval response: ${error.message}`, 'stderr'); }
  }

  #setStatus(id, status, message) {
    if (!allowedStatuses.has(status)) status = 'error';
    const progress = status === 'done' ? 100 : status === 'working' ? 25 : status === 'waiting' ? 50 : undefined;
    this.store.updateAgent(id, { status, ...(progress === undefined ? {} : { progress }), lastActivity: new Date().toISOString() }, message);
  }

  #appendLog(id, message, source = 'stdout') {
    const agent = this.#getAgent(id);
    const logs = [{ id: `codex-${Date.now()}-${Math.random().toString(16).slice(2)}`, at: new Date().toISOString(), message, level: source === 'stderr' ? 'error' : 'info', source }, ...(agent.logs || [])].slice(0, MAX_LOGS);
    this.store.updateAgent(id, { logs, lastActivity: new Date().toISOString() }, String(message).slice(0, 180), { recordLog: false });
  }

  #fail(session, message) {
    session.stopping = true;
    this.sessions.delete(session.id);
    this.#appendLog(session.id, message, 'stderr');
    this.store.updateAgent(session.id, { status: 'error', processId: null, approvals: [], lastActivity: new Date().toISOString() }, message);
  }

  #getAgent(id) {
    const agent = this.store.agents.find((item) => item.id === id && item.provider === 'codex');
    if (!agent) throw new Error('Codex agent not found.');
    return agent;
  }

  #validatedWorkspace(workspace) {
    if (typeof workspace !== 'string' || !workspace.trim()) throw new Error('Choose a workspace before starting Codex.');
    const resolved = fs.realpathSync(workspace);
    if (!fs.statSync(resolved).isDirectory()) throw new Error('The selected workspace must be a directory.');
    return path.resolve(resolved);
  }

  #findCli() {
    const configured = process.env.CODEX_CLI_PATH?.trim();
    if (configured && /[\\/]/.test(configured)) return fs.existsSync(configured) ? path.resolve(configured) : null;
    const command = configured || 'codex';
    try {
      if (process.platform === 'win32') return execFileSync('where.exe', [command], { encoding: 'utf8', windowsHide: true }).split(/\r?\n/).find(Boolean)?.trim() || null;
      return execFileSync('which', [command], { encoding: 'utf8' }).trim() || null;
    } catch { return null; }
  }

  #killTree(child) {
    if (!child.pid || child.exitCode !== null) return Promise.resolve();
    if (process.platform !== 'win32') { child.kill('SIGTERM'); return Promise.resolve(); }
    return new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      killer.on('error', () => { child.kill(); resolve(); });
      killer.on('close', () => resolve());
    });
  }
}
