/** Provider contract: list(), start(agentId), stop(agentId), setStatus(agentId, status), assignTask(agentId, task). */
export class AgentProvider {
  constructor(name) { this.name = name; }
  async list() { throw new Error('list() not implemented'); }
  async start() { throw new Error('start() not implemented'); }
  async stop() { throw new Error('stop() not implemented'); }
  async setStatus() { throw new Error('setStatus() not implemented'); }
  async assignTask() { throw new Error('assignTask() not implemented'); }
}
