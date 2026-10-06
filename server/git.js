import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function runGit(cmdArgs, cwd) {
  try {
    const stdout = execSync(`git ${cmdArgs}`, {
      cwd,
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    return { ok: true, output: stdout.trim() };
  } catch (err) {
    return {
      ok: false,
      output: (err.stdout || '') + (err.stderr || '') + (err.message || ''),
      error: err.message,
    };
  }
}

export class GitManager {
  constructor(defaultRepo = process.cwd()) {
    this.defaultRepo = defaultRepo;
    this.autoBackupInterval = null;
    this.history = [];
  }

  isGitRepo(cwd = this.defaultRepo) {
    try {
      return fs.existsSync(path.join(cwd, '.git'));
    } catch {
      return false;
    }
  }

  getStatus(cwd = this.defaultRepo) {
    if (!this.isGitRepo(cwd)) {
      return {
        isRepo: false,
        branch: 'None',
        clean: true,
        staged: 0,
        modified: 0,
        untracked: 0,
        ahead: 0,
        behind: 0,
        files: [],
        remoteUrl: null,
      };
    }

    const branchRes = runGit('rev-parse --abbrev-ref HEAD', cwd);
    const branch = branchRes.ok ? branchRes.output : 'main';

    const remoteRes = runGit('config --get remote.origin.url', cwd);
    const remoteUrl = remoteRes.ok ? remoteRes.output : null;

    const statusRes = runGit('status --porcelain', cwd);
    const lines = statusRes.ok && statusRes.output ? statusRes.output.split('\n') : [];

    let staged = 0;
    let modified = 0;
    let untracked = 0;
    const files = [];

    for (const line of lines) {
      if (!line) continue;
      const x = line[0];
      const y = line[1];
      const filePath = line.slice(3).trim();

      if (x !== ' ' && x !== '?') staged++;
      if (y !== ' ' && y !== '?') modified++;
      if (x === '?' && y === '?') untracked++;

      files.push({
        path: filePath,
        status: `${x}${y}`,
        type: x === '?' ? 'untracked' : x !== ' ' ? 'staged' : 'modified',
      });
    }

    return {
      isRepo: true,
      branch,
      clean: files.length === 0,
      staged,
      modified,
      untracked,
      totalChanges: files.length,
      files: files.slice(0, 50),
      remoteUrl,
    };
  }

  getLog(cwd = this.defaultRepo, limit = 15) {
    if (!this.isGitRepo(cwd)) return [];
    const logRes = runGit(`log -n ${limit} --pretty=format:"%H|%an|%ae|%ad|%s" --date=iso`, cwd);
    if (!logRes.ok || !logRes.output) return [];

    return logRes.output.split('\n').filter(Boolean).map((line) => {
      const [hash, author, email, date, ...subjectParts] = line.split('|');
      return {
        hash: hash?.slice(0, 8),
        fullHash: hash,
        author,
        email,
        date,
        message: subjectParts.join('|'),
      };
    });
  }

  getDiff(cwd = this.defaultRepo) {
    if (!this.isGitRepo(cwd)) return '';
    const diffRes = runGit('diff HEAD', cwd);
    if (diffRes.ok) return diffRes.output;
    const fallbackRes = runGit('diff', cwd);
    return fallbackRes.ok ? fallbackRes.output : '';
  }

  createSnapshot(cwd = this.defaultRepo, message = 'Automated AgentHub Snapshot', push = false) {
    if (!this.isGitRepo(cwd)) {
      runGit('init', cwd);
    }

    // Stage all changes
    const stageRes = runGit('add -A', cwd);
    if (!stageRes.ok) return { success: false, message: `Git stage failed: ${stageRes.output}` };

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const commitMsg = `[AgentHub Auto-Backup] ${message} (${timestamp})`;

    const commitRes = runGit(`commit -m "${commitMsg.replace(/"/g, '\\"')}"`, cwd);
    
    let pushResult = null;
    if (push) {
      const pushRes = runGit('push origin HEAD', cwd);
      pushResult = {
        success: pushRes.ok,
        output: pushRes.output,
      };
    }

    const logEntry = {
      id: `snap-${Date.now()}`,
      at: new Date().toISOString(),
      message: commitMsg,
      cwd,
      pushed: push && pushResult?.success,
    };
    this.history.unshift(logEntry);
    this.history = this.history.slice(0, 50);

    return {
      success: true,
      commitMessage: commitMsg,
      commitOutput: commitRes.output,
      pushResult,
      timestamp,
    };
  }

  createBranch(branchName, cwd = this.defaultRepo) {
    if (!this.isGitRepo(cwd)) throw new Error('Not a git repository');
    const safeName = branchName.replace(/[^a-zA-Z0-9_\-\/]/g, '-');
    const res = runGit(`checkout -b "${safeName}"`, cwd);
    if (!res.ok) throw new Error(`Could not create branch: ${res.output}`);
    return { success: true, branch: safeName };
  }

  syncRemote(cwd = this.defaultRepo) {
    if (!this.isGitRepo(cwd)) throw new Error('Not a git repository');
    const pullRes = runGit('pull --rebase origin HEAD', cwd);
    const pushRes = runGit('push origin HEAD', cwd);
    return {
      pull: { success: pullRes.ok, output: pullRes.output },
      push: { success: pushRes.ok, output: pushRes.output },
    };
  }
}
