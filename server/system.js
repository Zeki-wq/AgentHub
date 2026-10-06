import os from 'node:os';

function getCpuUsage() {
  const cpus = os.cpus();
  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;

  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }

  const total = user + nice + sys + idle + irq;
  return {
    idle,
    total,
    count: cpus.length,
    model: cpus[0]?.model || 'Unknown CPU',
    speed: cpus[0]?.speed || 0,
  };
}

let lastCpu = getCpuUsage();

export function getSystemTelemetry(agents = [], projects = []) {
  const currentCpu = getCpuUsage();
  const idleDiff = currentCpu.idle - lastCpu.idle;
  const totalDiff = currentCpu.total - lastCpu.total;
  const cpuPercent = totalDiff > 0 ? Math.max(1, Math.min(100, Math.round(100 - (100 * idleDiff) / totalDiff))) : 12;
  lastCpu = currentCpu;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = Math.round((usedMem / totalMem) * 100);

  const activeAgents = agents.filter((a) => ['working', 'waiting'].includes(a.status)).length;
  const totalTokens = agents.reduce((acc, a) => acc + (a.metrics?.tokens || (a.progress * 140) || 0), 0);
  const totalCost = (totalTokens / 1000 * 0.003).toFixed(3);

  return {
    cpu: {
      percent: cpuPercent,
      cores: currentCpu.count,
      model: currentCpu.model,
    },
    memory: {
      percent: memPercent,
      totalGb: (totalMem / (1024 ** 3)).toFixed(1),
      usedGb: (usedMem / (1024 ** 3)).toFixed(1),
      freeGb: (freeMem / (1024 ** 3)).toFixed(1),
    },
    os: {
      platform: os.platform(),
      type: os.type(),
      release: os.release(),
      hostname: os.hostname(),
      uptimeSeconds: os.uptime(),
      nodeVersion: process.version,
    },
    fleet: {
      totalAgents: agents.length,
      activeAgents,
      totalWorkspaces: projects.length,
      estimatedTokens: totalTokens,
      estimatedCostUsd: totalCost,
    },
  };
}
