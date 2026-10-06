import { AgentProvider } from './types.js';

const MOCK_SUBTASKS = [
  'Analyzing AST tree and import graph',
  'Synthesizing prompt context & retrieval chunks',
  'Executing sandbox workspace validation pass',
  'Generating refactored implementation diff',
  'Running regression test suite (14/14 passed)',
  'Performing static vulnerability scan',
  'Staging Git worktree snapshot',
];

export class MockAgentProvider extends AgentProvider {
  constructor(store) {
    super('mock');
    this.store = store;
  }

  async list() {
    return this.store.agents.filter((a) => a.provider === 'mock');
  }

  async start(id) {
    const agent = this.store.agents.find((a) => a.id === id);
    if (!agent) throw new Error('Agent not found');

    const updated = this.store.updateAgent(id, {
      status: 'working',
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      progress: 5,
    }, 'Agent session started');

    this.#appendLog(id, `Initialized runtime context for ${agent.name} (${agent.model || 'Mock / GPT-4.1'})`, 'info');
    return updated;
  }

  async stop(id) {
    return this.store.updateAgent(id, {
      status: 'stopped',
      lastActivity: new Date().toISOString(),
    }, 'Agent session paused');
  }

  async setStatus(id, status) {
    const allowed = ['idle', 'working', 'waiting', 'done', 'error', 'stopped'];
    if (!allowed.includes(status)) throw new Error('Unsupported agent status');
    return this.store.updateAgent(id, { status, lastActivity: new Date().toISOString() }, `Status changed to ${status}`);
  }

  async assignTask(id, task) {
    if (!task?.trim()) throw new Error('Task description is required');
    const agent = this.store.updateAgent(id, {
      currentTask: task.trim(),
      status: 'working',
      progress: 0,
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    }, `Assigned task: ${task.trim()}`);

    this.#appendLog(id, `Task accepted: "${task.trim()}"`, 'info');
    this.#appendLog(id, `Beginning step 1: ${MOCK_SUBTASKS[0]}`, 'info');

    // Trigger mock approval if task mentions sensitive keyword
    if (/delete|remove|deploy|production|drop|exec/i.test(task)) {
      setTimeout(() => {
        const curAgent = this.store.agents.find((a) => a.id === id);
        if (curAgent && curAgent.status === 'working') {
          const approval = {
            requestId: `req-${Date.now()}`,
            method: 'terminal/dangerousCommand',
            summary: `Agent requests permission to execute potentially destructive operation for: "${task}"`,
            createdAt: new Date().toISOString(),
          };
          curAgent.approvals = [approval, ...(curAgent.approvals || [])];
          curAgent.status = 'waiting';
          this.store.updateAgent(id, { status: 'waiting', approvals: curAgent.approvals }, 'Waiting for security approval');
          this.#appendLog(id, `SECURITY GUARD: Paused for human approval: "${approval.summary}"`, 'warn');
        }
      }, 2000);
    }

    return agent;
  }

  #appendLog(id, message, level = 'info') {
    const agent = this.store.agents.find((a) => a.id === id);
    if (agent) {
      const log = {
        id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        at: new Date().toISOString(),
        message,
        level,
        source: 'agent',
      };
      agent.logs = [log, ...(agent.logs || [])].slice(0, 150);
    }
  }
}
