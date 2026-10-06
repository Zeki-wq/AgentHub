import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/agenthub.json');
const MAX_AGENT_LOGS = 250;
const now = Date.now();

const seed = {
  projects: [
    {
      id: 'prj-agenthub',
      name: 'AgentHub Core',
      path: 'c:/Users/Zeki/AgentHub',
      color: '#6366f1',
      gitRepo: 'https://github.com/Zeki-wq/AgentHub.git',
      createdAt: new Date(now - 86400000 * 2).toISOString(),
    },
    {
      id: 'prj-atlas',
      name: 'Atlas Dashboard',
      path: 'C:/work/atlas-dashboard',
      color: '#06b6d4',
      gitRepo: 'https://github.com/company/atlas-dashboard.git',
      createdAt: new Date(now - 86400000 * 8).toISOString(),
    },
    {
      id: 'prj-nova',
      name: 'Nova AI Services',
      path: 'C:/work/nova-api',
      color: '#10b981',
      gitRepo: 'https://github.com/company/nova-api.git',
      createdAt: new Date(now - 86400000 * 4).toISOString(),
    },
  ],
  agents: [
    {
      id: 'agt-claude-01',
      name: 'Claude Code Agent',
      provider: 'cli',
      project: 'prj-agenthub',
      status: 'working',
      currentTask: 'Refining local multi-agent fleet orchestrator & Git continuous backup engine',
      startedAt: new Date(now - 1000 * 60 * 12).toISOString(),
      lastActivity: new Date(now - 1000 * 15).toISOString(),
      progress: 88,
      model: 'Claude 3.7 Sonnet / CLI',
      workspace: 'c:/Users/Zeki/AgentHub',
      cliConfig: { command: 'claude', args: ['--non-interactive'] },
      metrics: { tokens: 14280, cost: 0.042, speedTps: 58.4 },
      logs: [
        { id: 'l-cl-1', at: new Date(now - 1000 * 120).toISOString(), message: 'Connected to AgentHub mission control bridge via STDIO', source: 'agent', level: 'info' },
        { id: 'l-cl-2', at: new Date(now - 1000 * 60).toISOString(), message: 'Scanning local repository tree and AST bindings...', source: 'stdout', level: 'info' },
        { id: 'l-cl-3', at: new Date(now - 1000 * 15).toISOString(), message: 'Generated Git backup sync adapter and real-time telemetry HUD', source: 'stdout', level: 'info' },
      ],
      approvals: [],
    },
    {
      id: 'agt-aider-02',
      name: 'Aider Pair Programmer',
      provider: 'cli',
      project: 'prj-atlas',
      status: 'idle',
      currentTask: 'Standing by for automated refactoring instructions',
      startedAt: new Date(now - 1000 * 60 * 45).toISOString(),
      lastActivity: new Date(now - 1000 * 60 * 5).toISOString(),
      progress: 0,
      model: 'Aider CLI / DeepSeek-Coder',
      workspace: 'C:/work/atlas-dashboard',
      cliConfig: { command: 'aider', args: ['--no-auto-commits'] },
      metrics: { tokens: 8400, cost: 0.012, speedTps: 72.1 },
      logs: [
        { id: 'l-aid-1', at: new Date(now - 1000 * 60 * 5).toISOString(), message: 'Aider daemon initialized with git worktree isolation.', source: 'stdout', level: 'info' },
      ],
      approvals: [],
    },
    {
      id: 'agt-001',
      name: 'Frontend Architect Agent',
      provider: 'mock',
      project: 'prj-atlas',
      status: 'working',
      currentTask: 'Optimizing responsive glassmorphism HUD & real-time telemetry stream',
      startedAt: new Date(now - 1000 * 60 * 25).toISOString(),
      lastActivity: new Date(now - 1000 * 22).toISOString(),
      progress: 74,
      model: 'Simulated / GPT-4.5 Ultra',
      workspace: 'C:/work/atlas-dashboard',
      metrics: { tokens: 24500, cost: 0.073, speedTps: 64.0 },
      logs: [
        { id: 'l1', at: new Date(now - 1000 * 40).toISOString(), message: 'Synthesized telemetry widgets & animated sparklines', level: 'info', source: 'agent' },
        { id: 'l2', at: new Date(now - 1000 * 22).toISOString(), message: 'Rendering multi-agent pipeline node graph layout pass', level: 'info', source: 'agent' },
      ],
      approvals: [],
    },
    {
      id: 'agt-002',
      name: 'Security Auditor Agent',
      provider: 'mock',
      project: 'prj-nova',
      status: 'waiting',
      currentTask: 'Reviewing JWT authentication boundaries and rate-limiter rules',
      startedAt: new Date(now - 1000 * 60 * 55).toISOString(),
      lastActivity: new Date(now - 1000 * 60 * 2).toISOString(),
      progress: 52,
      model: 'Simulated / Claude 3.5 Sonnet',
      workspace: 'C:/work/nova-api',
      metrics: { tokens: 19100, cost: 0.057, speedTps: 81.2 },
      logs: [
        { id: 'l3', at: new Date(now - 1000 * 60 * 2).toISOString(), message: 'SECURITY GUARD: Paused waiting for human decision on permission grant', level: 'warn', source: 'agent' },
      ],
      approvals: [
        {
          requestId: 'req-sec-991',
          method: 'fileChange/writePermission',
          summary: 'Security Auditor requests permission to apply strict CSRF and CORS header patch to production auth middleware.',
          createdAt: new Date(now - 1000 * 60 * 2).toISOString(),
        },
      ],
    },
    {
      id: 'agt-003',
      name: 'Automated Test Crafter',
      provider: 'mock',
      project: 'prj-agenthub',
      status: 'done',
      currentTask: 'Added 100% end-to-end coverage for Git snapshot and PTY command streams',
      startedAt: new Date(now - 1000 * 60 * 90).toISOString(),
      lastActivity: new Date(now - 1000 * 60 * 8).toISOString(),
      progress: 100,
      model: 'Simulated / GPT-4.1',
      workspace: 'c:/Users/Zeki/AgentHub',
      metrics: { tokens: 31200, cost: 0.093, speedTps: 92.5 },
      logs: [
        { id: 'l4', at: new Date(now - 1000 * 60 * 8).toISOString(), message: 'All 38 integration tests passed. Staged git snapshot.', level: 'info', source: 'agent' },
      ],
      approvals: [],
    },
  ],
  activities: [
    { id: 'ev-init-1', at: new Date(now - 1000 * 15).toISOString(), agentId: 'agt-claude-01', message: 'Claude Code Agent generated Git backup sync adapter and real-time telemetry HUD', type: 'working' },
    { id: 'ev-init-2', at: new Date(now - 1000 * 60 * 2).toISOString(), agentId: 'agt-002', message: 'Security Auditor paused for human authorization', type: 'waiting' },
    { id: 'ev-init-3', at: new Date(now - 1000 * 60 * 8).toISOString(), agentId: 'agt-003', message: 'Automated Test Crafter finished test coverage suite (100% pass)', type: 'done' },
    { id: 'ev-init-4', at: new Date(now - 1000 * 60 * 25).toISOString(), agentId: 'agt-001', message: 'Frontend Architect updated telemetry widgets & sparklines', type: 'working' },
  ],
};

function persist() {
  try {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Failed to persist AgentHub state:', e);
  }
}

let state;
try {
  state = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  // Ensure default projects and agents exist if empty
  if (!state.projects || state.projects.length === 0) state.projects = structuredClone(seed.projects);
  if (!state.agents || state.agents.length === 0) state.agents = structuredClone(seed.agents);
  if (!state.activities) state.activities = structuredClone(seed.activities);
} catch {
  state = structuredClone(seed);
}

export const store = {
  get projects() { return state.projects; },
  get agents() { return state.agents; },
  get activities() { return state.activities; },

  addActivity(agentId, message, type = 'progress') {
    const event = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      agentId,
      message,
      type,
    };
    state.activities.unshift(event);
    state.activities = state.activities.slice(0, 150);
    return event;
  },

  updateAgent(id, patch, message, { recordLog = true } = {}) {
    const agent = state.agents.find((item) => item.id === id);
    if (!agent) throw new Error('Agent not found');
    Object.assign(agent, patch);
    if (recordLog && message) {
      const log = {
        id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        at: new Date().toISOString(),
        message,
        level: patch.status === 'error' ? 'error' : 'info',
        source: 'agent',
      };
      agent.logs = [log, ...(agent.logs || [])].slice(0, MAX_AGENT_LOGS);
    }
    if (message) {
      this.addActivity(id, message, patch.status || 'progress');
    }
    persist();
    return agent;
  },

  addProject(input) {
    const project = {
      id: `prj-${Date.now()}`,
      name: input.name.trim(),
      path: input.path.trim(),
      color: input.color || '#6366f1',
      gitRepo: input.gitRepo || '',
      createdAt: new Date().toISOString(),
    };
    state.projects.unshift(project);
    persist();
    return project;
  },

  deleteProject(id) {
    state.projects = state.projects.filter((p) => p.id !== id);
    persist();
    return { ok: true };
  },

  addAgent(input) {
    const project = state.projects.find((item) => item.id === input.project);
    const agent = {
      id: `agt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: input.name?.trim() || `${input.provider.toUpperCase()} Agent`,
      provider: input.provider || 'mock',
      project: project ? project.id : (state.projects[0]?.id || 'prj-agenthub'),
      status: 'idle',
      currentTask: input.task || 'Standing by for instructions',
      startedAt: null,
      lastActivity: new Date().toISOString(),
      progress: 0,
      model: input.model || (input.provider === 'cli' ? (input.cliCommand || 'CLI Agent') : input.provider === 'codex' ? 'Codex CLI default' : 'Simulated / GPT-4.5'),
      workspace: input.workspace || project?.path || process.cwd(),
      cliConfig: input.cliConfig || { command: input.cliCommand || 'claude', args: input.cliArgs || [] },
      metrics: { tokens: 0, cost: 0, speedTps: 0 },
      logs: [
        {
          id: `l-init-${Date.now()}`,
          at: new Date().toISOString(),
          message: `Agent registered in AgentHub mission control for workspace: ${input.workspace || project?.path}`,
          level: 'info',
          source: 'system',
        },
      ],
      approvals: [],
      processId: null,
      threadId: null,
    };
    state.agents.unshift(agent);
    this.addActivity(agent.id, `Created agent "${agent.name}" (${agent.provider})`, 'idle');
    persist();
    return agent;
  },

  deleteAgent(id) {
    state.agents = state.agents.filter((a) => a.id !== id);
    persist();
    return { ok: true };
  },

  exportState() {
    return JSON.stringify(state, null, 2);
  },

  importState(jsonString) {
    const parsed = JSON.parse(jsonString);
    if (!parsed.projects || !parsed.agents) throw new Error('Invalid AgentHub backup format');
    state = parsed;
    persist();
    return state;
  },
};
