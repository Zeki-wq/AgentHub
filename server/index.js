import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { store } from './store.js';
import { MockAgentProvider } from './providers/mock.js';
import { CodexAgentProvider } from './providers/codex.js';
import { CliAgentProvider } from './providers/cli.js';
import { GitManager } from './git.js';
import { scanInstalledAgents } from './discovery.js';
import { getSystemTelemetry } from './system.js';
import { SwarmEngine } from './swarm.js';

const app = express();
const port = Number(process.env.AGENTHUB_PORT || 4317);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const gitManager = new GitManager(root);
const swarmEngine = new SwarmEngine(store, gitManager);
const providers = {
  mock: new MockAgentProvider(store),
  codex: new CodexAgentProvider(store),
  cli: new CliAgentProvider(store),
};

app.use(express.json({ limit: '10mb' }));

// Health and provider status
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    providers: {
      mock: true,
      codex: providers.codex.available,
      cli: true,
    },
    version: '1.0.0-revolutionary',
    timestamp: new Date().toISOString(),
  });
});

// System telemetry & hardware metrics
app.get('/api/system/metrics', (_req, res) => {
  try {
    const metrics = getSystemTelemetry(store.agents, store.projects);
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Local installed AI Agent scanner
app.get('/api/discovery', async (_req, res) => {
  try {
    const tools = await scanInstalledAgents();
    res.json({ tools, scannedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Projects / Workspaces
app.get('/api/projects', (_req, res) => res.json(store.projects));
app.post('/api/projects', (req, res) => {
  if (!req.body?.name?.trim() || !req.body?.path?.trim()) {
    return res.status(400).json({ error: 'Project name and workspace path are required' });
  }
  res.status(201).json(store.addProject(req.body));
});
app.delete('/api/projects/:id', (req, res) => {
  res.json(store.deleteProject(req.params.id));
});

// Agents
app.get('/api/agents', (_req, res) => res.json(store.agents));
app.post('/api/agents', (req, res) => {
  const { provider = 'mock', project, name, workspace, model, cliCommand, cliArgs } = req.body || {};
  if (!['mock', 'codex', 'cli'].includes(provider)) {
    return res.status(400).json({ error: 'Supported providers are mock, codex, or cli' });
  }
  const proj = store.projects.find((p) => p.id === project) || store.projects[0];
  const finalWorkspace = workspace || proj?.path || root;

  try {
    const agent = store.addAgent({
      provider,
      project: proj?.id,
      name,
      workspace: finalWorkspace,
      model,
      cliCommand,
      cliArgs,
    });
    return res.status(201).json(agent);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get('/api/agents/:id', (req, res) => {
  const agent = store.agents.find((item) => item.id === req.params.id);
  return agent ? res.json(agent) : res.status(404).json({ error: 'Agent not found' });
});

app.delete('/api/agents/:id', (req, res) => {
  res.json(store.deleteAgent(req.params.id));
});

// Agent actions
app.post('/api/agents/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  const agent = store.agents.find((item) => item.id === id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const provider = providers[agent.provider];
  if (!provider) return res.status(400).json({ error: 'Unknown agent provider' });

  try {
    if (action === 'start') return res.json(await provider.start(id, { confirmed: req.body?.confirm === true }));
    if (action === 'stop') return res.json(await provider.stop(id, { confirmed: req.body?.confirm === true }));
    if (action === 'status') return res.json(await provider.setStatus(id, req.body?.status));
    if (action === 'task') return res.json(await provider.assignTask(id, req.body?.task, { confirmed: req.body?.confirm === true }));
    if (action === 'stdin') {
      if (agent.provider === 'cli') {
        return res.json(await providers.cli.sendStdin(id, req.body?.input));
      }
      return res.status(400).json({ error: 'Stdin is only supported for CLI agents' });
    }
    if (action === 'approval') {
      if (agent.provider === 'codex') {
        return res.json(await providers.codex.respondToApproval(id, req.body?.requestId, req.body?.decision));
      }
      // Mock approval handling
      const curApprovals = agent.approvals || [];
      const updated = curApprovals.filter((a) => a.requestId !== req.body?.requestId);
      const isAccepted = req.body?.decision === 'accept';
      store.updateAgent(id, {
        approvals: updated,
        status: isAccepted ? 'working' : 'stopped',
        lastActivity: new Date().toISOString(),
      }, `Security approval ${isAccepted ? 'GRANTED' : 'DENIED'} by operator`);
      return res.json(agent);
    }
    return res.status(404).json({ error: 'Unknown action' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Git Operations & Backup
app.get('/api/git/status', (req, res) => {
  const cwd = req.query.path || root;
  res.json(gitManager.getStatus(cwd));
});

app.get('/api/git/log', (req, res) => {
  const cwd = req.query.path || root;
  const limit = Number(req.query.limit || 15);
  res.json(gitManager.getLog(cwd, limit));
});

app.get('/api/git/diff', (req, res) => {
  const cwd = req.query.path || root;
  res.json({ diff: gitManager.getDiff(cwd) });
});

app.post('/api/git/snapshot', (req, res) => {
  const { path: cwd = root, message = 'Manual AgentHub snapshot', push = false } = req.body || {};
  try {
    const result = gitManager.createSnapshot(cwd, message, push);
    store.addActivity('system', `Git Snapshot: "${result.commitMessage}"`, 'done');
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/git/sync', (req, res) => {
  const { path: cwd = root } = req.body || {};
  try {
    const result = gitManager.syncRemote(cwd);
    store.addActivity('system', 'Synchronized with remote Git repository', 'done');
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/git/branch', (req, res) => {
  const { path: cwd = root, branchName } = req.body || {};
  if (!branchName) return res.status(400).json({ error: 'Branch name is required' });
  try {
    const result = gitManager.createBranch(branchName, cwd);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Swarm / Multi-Agent Pipelines
app.get('/api/pipelines/templates', (_req, res) => {
  res.json(swarmEngine.getTemplates());
});

app.get('/api/pipelines/runs', (_req, res) => {
  res.json(swarmEngine.listRuns());
});

app.post('/api/pipelines/start', (req, res) => {
  const { templateId, projectId, prompt } = req.body || {};
  try {
    const run = swarmEngine.startPipeline(templateId, projectId, prompt);
    res.status(201).json(run);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Activity log
app.get('/api/activity', (_req, res) => res.json(store.activities));

// State Export / Import
app.get('/api/backup/export', (_req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="agenthub-fleet-backup.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(store.exportState());
});

app.post('/api/backup/import', (req, res) => {
  try {
    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const updated = store.importState(payload);
    res.json({ ok: true, state: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mock simulation & live metric tick loop
setInterval(() => {
  for (const agent of store.agents) {
    if (agent.status !== 'working') continue;

    if (agent.provider === 'mock') {
      const step = Math.floor(Math.random() * 6) + 2;
      const progress = Math.min(100, (agent.progress || 0) + step);
      const finished = progress >= 100;

      // Update tokens
      const newTokens = (agent.metrics?.tokens || 1000) + Math.floor(Math.random() * 120) + 40;
      const speed = +(45 + Math.random() * 40).toFixed(1);

      store.updateAgent(
        agent.id,
        {
          progress,
          status: finished ? 'done' : 'working',
          lastActivity: new Date().toISOString(),
          metrics: {
            tokens: newTokens,
            cost: +(newTokens / 1000 * 0.003).toFixed(3),
            speedTps: speed,
          },
        },
        finished ? 'Task completed successfully' : `Execution milestone reached (${progress}%)`,
        { recordLog: false }
      );
    }
  }
}, 6000).unref();

// Periodic Auto-Git Snapshot every 10 minutes if there are dirty changes
setInterval(() => {
  try {
    const status = gitManager.getStatus(root);
    if (status.isRepo && !status.clean) {
      gitManager.createSnapshot(root, 'Autonomous Fleet Checkpoint (10m interval)');
      store.addActivity('system', 'Automated 10m periodic Git snapshot captured', 'progress');
    }
  } catch {}
}, 600000).unref();

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(root, 'dist')));
  app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
}

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`🚀 AgentHub Mission Control ready at http://127.0.0.1:${port}`);
});

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await providers.codex.shutdown?.();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
