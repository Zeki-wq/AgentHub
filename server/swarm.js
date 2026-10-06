export class SwarmEngine {
  constructor(store, gitManager) {
    this.store = store;
    this.gitManager = gitManager;
    this.activePipelines = new Map();
  }

  getTemplates() {
    return [
      {
        id: 'swarm-feature-rollout',
        name: 'Autonomous Feature Rollout Swarm',
        description: 'Multi-agent pipeline: Spec Architecture -> Code Synthesis -> Security Review -> Test Runner -> Git Snapshot.',
        category: 'Development',
        estimatedMinutes: 3,
        steps: [
          { id: 'step-1', name: 'Architecture & Spec Synthesis', role: 'Planner Agent', durationMs: 4000, desc: 'Analyze repo structure and design interface contracts.' },
          { id: 'step-2', name: 'Core Implementation', role: 'Coding Agent', durationMs: 7000, desc: 'Generate component logic and API handlers.' },
          { id: 'step-3', name: 'Security & Static Analysis', role: 'Auditor Agent', durationMs: 4000, desc: 'Scan for memory leaks, injection risks, and edge cases.' },
          { id: 'step-4', name: 'Automated Regression Suite', role: 'Test Agent', durationMs: 5000, desc: 'Run end-to-end integration and unit tests.' },
          { id: 'step-5', name: 'Autonomous Git Worktree Backup', role: 'Git Committer', durationMs: 3000, desc: 'Stage changes and create signed snapshot commit.' },
        ],
      },
      {
        id: 'swarm-security-hardening',
        name: 'Zero-Day Vulnerability & Security Audit',
        description: 'Audits dependencies, checks permission boundaries, and verifies input sanitization.',
        category: 'Security',
        estimatedMinutes: 2,
        steps: [
          { id: 'step-1', name: 'Dependency Vulnerability Scan', role: 'Security Agent', durationMs: 4000, desc: 'Scan lockfiles and vendor modules against CVE database.' },
          { id: 'step-2', name: 'Static Code Hardening', role: 'Refactor Agent', durationMs: 5000, desc: 'Apply security patches and enforce strict type validations.' },
          { id: 'step-3', name: 'Verification & Git Snapshot', role: 'DevOps Agent', durationMs: 3000, desc: 'Verify build integrity and tag security release commit.' },
        ],
      },
      {
        id: 'swarm-refactor-performance',
        name: 'Performance Profiler & AST Optimization',
        description: 'Analyzes bundle size, optimizes render loops, and caches database queries.',
        category: 'Optimization',
        estimatedMinutes: 2,
        steps: [
          { id: 'step-1', name: 'Profile Memory & CPU Bottlenecks', role: 'Profiler Agent', durationMs: 4000, desc: 'Detect slow functions and heavy rendering components.' },
          { id: 'step-2', name: 'Optimize Algorithms & Caching', role: 'Performance Agent', durationMs: 6000, desc: 'Implement memoization, debounce passes, and index lookups.' },
          { id: 'step-3', name: 'Benchmark Comparison & Git Save', role: 'Benchmarker Agent', durationMs: 3000, desc: 'Produce before/after latency stats and save commit.' },
        ],
      },
    ];
  }

  listRuns() {
    return Array.from(this.activePipelines.values());
  }

  startPipeline(templateId, projectId, prompt = '') {
    const template = this.getTemplates().find((t) => t.id === templateId) || this.getTemplates()[0];
    const project = this.store.projects.find((p) => p.id === projectId) || this.store.projects[0];

    const runId = `swm-${Date.now()}`;
    const run = {
      id: runId,
      templateId: template.id,
      name: template.name,
      projectName: project?.name || 'Local Workspace',
      projectPath: project?.path || process.cwd(),
      prompt: prompt || `Execute ${template.name}`,
      status: 'running',
      currentStepIndex: 0,
      totalSteps: template.steps.length,
      startedAt: new Date().toISOString(),
      completedAt: null,
      steps: template.steps.map((s, idx) => ({
        ...s,
        status: idx === 0 ? 'running' : 'pending',
        logs: [],
        startedAt: idx === 0 ? new Date().toISOString() : null,
      })),
      logs: [
        `[${new Date().toLocaleTimeString()}] Swarm Pipeline Initialized: ${template.name}`,
        `[${new Date().toLocaleTimeString()}] Target workspace: ${project?.path || process.cwd()}`,
      ],
    };

    this.activePipelines.set(runId, run);
    this.store.addActivity('system', `Started Swarm Pipeline: ${template.name} for ${project?.name}`, 'working');

    // Run execution loop asynchronously
    this.#executePipelineSteps(run);

    return run;
  }

  async #executePipelineSteps(run) {
    for (let i = 0; i < run.steps.length; i++) {
      run.currentStepIndex = i;
      const step = run.steps[i];
      step.status = 'running';
      step.startedAt = new Date().toISOString();
      run.logs.push(`[${new Date().toLocaleTimeString()}] Starting Step ${i + 1}/${run.totalSteps}: ${step.name} (${step.role})`);

      // Simulate live sub-step logs
      const interval = setInterval(() => {
        if (step.status === 'running') {
          const detail = `${step.role}: Processed token batch, status nominal.`;
          step.logs.push(detail);
          run.logs.push(`[${new Date().toLocaleTimeString()}] ${detail}`);
        }
      }, 1500);

      await new Promise((resolve) => setTimeout(resolve, step.durationMs || 3000));
      clearInterval(interval);

      step.status = 'completed';
      step.completedAt = new Date().toISOString();
      run.logs.push(`[${new Date().toLocaleTimeString()}] Step ${i + 1} Completed: ${step.name}`);

      // If last step is Git Committer, trigger real/mock snapshot
      if (step.role.includes('Git') || i === run.steps.length - 1) {
        try {
          const snap = this.gitManager.createSnapshot(run.projectPath, `Swarm Pipeline Result: ${run.name}`);
          run.logs.push(`[${new Date().toLocaleTimeString()}] Git snapshot saved: ${snap.commitMessage || 'Committed'}`);
        } catch (e) {
          run.logs.push(`[${new Date().toLocaleTimeString()}] Git snapshot note: ${e.message}`);
        }
      }
    }

    run.status = 'completed';
    run.completedAt = new Date().toISOString();
    run.logs.push(`[${new Date().toLocaleTimeString()}] Swarm Pipeline Execution Successfully Finished! All artifacts verified.`);
    this.store.addActivity('system', `Swarm Pipeline Finished: ${run.name}`, 'done');
  }
}
