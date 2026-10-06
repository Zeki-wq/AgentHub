import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Activity, AlertCircle, ArrowUpRight, Bot,
  Check, ChevronDown, ChevronLeft, Circle, CircleDot, Clock3, Command, FolderOpen,
  LayoutDashboard, LoaderCircle, Menu, Plus, RefreshCw, Send, Settings, ShieldCheck,
  Square, Terminal, X, GitBranch, Cpu, Globe, Volume2, VolumeX, Sparkles, HardDrive,
  Copy, Play, Pause, Download, Upload, Search, HelpCircle, Flame, Layers, ExternalLink
} from 'lucide-react';
import { translations } from './i18n.js';
import { sfx } from './audio.js';

const statusMeta = {
  working: { label: 'Working', className: 'working' },
  waiting: { label: 'Waiting', className: 'waiting' },
  idle: { label: 'Idle', className: 'idle' },
  done: { label: 'Done', className: 'done' },
  error: { label: 'Error', className: 'error' },
  stopped: { label: 'Stopped', className: 'stopped' },
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function ago(value) {
  if (!value) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('agenthub_lang') || 'tr');
  const [soundOn, setSoundOn] = useState(sfx.enabled);
  const [page, setPage] = useState('Dashboard');
  const [agents, setAgents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [events, setEvents] = useState([]);
  const [health, setHealth] = useState(null);
  const [systemMetrics, setSystemMetrics] = useState(null);
  const [gitStatus, setGitStatus] = useState(null);
  const [discoveredTools, setDiscoveredTools] = useState([]);
  const [swarmTemplates, setSwarmTemplates] = useState([]);
  const [swarmRuns, setSwarmRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [workspaceFilter, setWorkspaceFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState('');
  const [pitchOpen, setPitchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Modal form states
  const [taskAgent, setTaskAgent] = useState(null);
  const [taskText, setTaskText] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentProvider, setAgentProvider] = useState('cli');
  const [agentProject, setAgentProject] = useState('');
  const [agentCommand, setAgentCommand] = useState('claude');
  const [snapshotMsg, setSnapshotMsg] = useState('');

  const t = translations[lang] || translations.en;

  const toggleLanguage = () => {
    const next = lang === 'en' ? 'tr' : 'en';
    setLang(next);
    localStorage.setItem('agenthub_lang', next);
    sfx.playClick();
  };

  const toggleSound = () => {
    const active = sfx.toggle();
    setSoundOn(active);
  };

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [agentData, projectData, activityData, healthData, metricsData, gitData, discoveryData, swarmTplData, swarmRunData] = await Promise.all([
        api('/api/agents'),
        api('/api/projects'),
        api('/api/activity'),
        api('/api/health'),
        api('/api/system/metrics').catch(() => null),
        api('/api/git/status').catch(() => null),
        api('/api/discovery').catch(() => ({ tools: [] })),
        api('/api/pipelines/templates').catch(() => []),
        api('/api/pipelines/runs').catch(() => []),
      ]);
      setAgents(agentData);
      setProjects(projectData);
      setEvents(activityData);
      setHealth(healthData);
      if (metricsData) setSystemMetrics(metricsData);
      if (gitData) setGitStatus(gitData);
      if (discoveryData?.tools) setDiscoveredTools(discoveryData.tools);
      if (swarmTplData) setSwarmTemplates(swarmTplData);
      if (swarmRunData) setSwarmRuns(swarmRunData);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(true);
    const refreshTimer = setInterval(() => refresh(), 3000);
    const clockTimer = setInterval(() => setNow(Date.now()), 10000);
    return () => {
      clearInterval(refreshTimer);
      clearInterval(clockTimer);
    };
  }, [refresh]);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedAgent = agents.find((a) => a.id === selectedId);
  const agentWorkspace = (agent) => projects.find((p) => p.id === agent?.project);
  const pendingApprovals = useMemo(() => agents.flatMap((a) => (a.approvals || []).map((appr) => ({ agent: a, approval: appr }))), [agents]);

  const counts = useMemo(() => ({
    active: agents.filter((a) => ['working', 'waiting'].includes(a.status)).length,
    working: agents.filter((a) => a.status === 'working').length,
    waiting: agents.filter((a) => a.status === 'waiting').length,
    completed: agents.filter((a) => a.status === 'done').length,
    totalTokens: agents.reduce((sum, a) => sum + (a.metrics?.tokens || (a.progress * 120) || 0), 0),
  }), [agents]);

  const act = async (agent, action, body = {}) => {
    setBusy(true);
    setError('');
    try {
      sfx.playClick();
      await api(`/api/agents/${agent.id}/${action}`, { method: 'POST', body: JSON.stringify(body) });
      sfx.playSuccess();
      await refresh();
      return true;
    } catch (err) {
      sfx.playAlert();
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/projects', { method: 'POST', body: JSON.stringify({ name: projectName, path: projectPath }) });
      setProjectName('');
      setProjectPath('');
      setModal('');
      sfx.playSuccess();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  const handleSpawnAgent = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/agents', {
        method: 'POST',
        body: JSON.stringify({
          name: agentName || `${agentCommand.toUpperCase()} Agent`,
          provider: agentProvider,
          project: agentProject || projects[0]?.id,
          cliCommand: agentCommand,
        }),
      });
      setAgentName('');
      setModal('');
      sfx.playSuccess();
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!taskAgent || !taskText.trim()) return;
    const sent = await act(taskAgent, 'task', { task: taskText, confirm: taskAgent.provider === 'codex' });
    if (sent) {
      setModal('');
      setTaskText('');
    }
  };

  const triggerInstantSnapshot = async () => {
    setBusy(true);
    try {
      sfx.playClick();
      const res = await api('/api/git/snapshot', {
        method: 'POST',
        body: JSON.stringify({ message: snapshotMsg || 'Mission Control Instant Checkpoint', push: false }),
      });
      sfx.playSuccess();
      setModal('');
      setSnapshotMsg('');
      await refresh();
    } catch (err) {
      sfx.playAlert();
      setError(err.message);
    } finally { setBusy(false); }
  };

  const triggerSwarmRun = async (templateId) => {
    setBusy(true);
    try {
      sfx.playClick();
      await api('/api/pipelines/start', {
        method: 'POST',
        body: JSON.stringify({
          templateId,
          projectId: projects[0]?.id,
        }),
      });
      sfx.playSuccess();
      setPage('Swarm');
      await refresh();
    } catch (err) {
      sfx.playAlert();
      setError(err.message);
    } finally { setBusy(false); }
  };

  const navigation = [
    { id: 'Dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'Agents', label: t.nav.agents, icon: Bot, count: agents.length },
    { id: 'Swarm', label: t.nav.swarms, icon: Layers, count: swarmRuns.filter((r) => r.status === 'running').length },
    { id: 'Git', label: t.nav.git, icon: GitBranch },
    { id: 'Scanner', label: t.nav.scanner, icon: Cpu },
    { id: 'Workspaces', label: t.nav.workspaces, icon: FolderOpen },
    { id: 'Approvals', label: t.nav.approvals, icon: ShieldCheck, count: pendingApprovals.length, alert: pendingApprovals.length > 0 },
    { id: 'Telemetry', label: t.nav.telemetry, icon: Activity },
    { id: 'Settings', label: t.nav.settings, icon: Settings },
  ];

  const content = selectedAgent ? (
    <AgentStudio
      agent={selectedAgent}
      workspace={agentWorkspace(selectedAgent)}
      busy={busy}
      now={now}
      t={t}
      onBack={() => setSelectedId(null)}
      onAction={act}
      onApproval={(reqId, decision) => act(selectedAgent, 'approval', { requestId: reqId, decision })}
      onSubmitTask={(task) => act(selectedAgent, 'task', { task, confirm: selectedAgent.provider === 'codex' })}
      onSendStdin={(input) => act(selectedAgent, 'stdin', { input })}
    />
  ) : page === 'Dashboard' ? (
    <DashboardView
      agents={agents}
      projects={projects}
      events={events}
      counts={counts}
      systemMetrics={systemMetrics}
      gitStatus={gitStatus}
      pendingApprovals={pendingApprovals}
      swarmRuns={swarmRuns}
      workspaceFor={agentWorkspace}
      t={t}
      onNavigate={(p) => { setPage(p); setSelectedId(null); }}
      onOpenAgent={(id) => setSelectedId(id)}
      onOpenWorkspace={(pId) => { setWorkspaceFilter(pId); setPage('Agents'); }}
      onTask={(ag) => { setTaskAgent(ag); setModal('task'); }}
      onAction={act}
      onSpawn={() => { setAgentProject(projects[0]?.id || ''); setModal('spawn'); }}
      onSnapshot={() => setModal('snapshot')}
      onRunSwarm={triggerSwarmRun}
      busy={busy}
      now={now}
    />
  ) : page === 'Agents' ? (
    <AgentFleetView
      agents={agents}
      projects={projects}
      filterProject={workspaceFilter}
      searchQuery={searchQuery}
      t={t}
      onClearProject={() => setWorkspaceFilter(null)}
      onOpen={(id) => setSelectedId(id)}
      onTask={(ag) => { setTaskAgent(ag); setModal('task'); }}
      onAction={act}
      onSpawn={() => { setAgentProject(projects[0]?.id || ''); setModal('spawn'); }}
      busy={busy}
      now={now}
    />
  ) : page === 'Swarm' ? (
    <SwarmView
      templates={swarmTemplates}
      runs={swarmRuns}
      projects={projects}
      t={t}
      onRunSwarm={triggerSwarmRun}
      busy={busy}
    />
  ) : page === 'Git' ? (
    <GitBackupView
      gitStatus={gitStatus}
      projects={projects}
      t={t}
      onSnapshot={() => setModal('snapshot')}
      onRefresh={() => refresh(true)}
      busy={busy}
    />
  ) : page === 'Scanner' ? (
    <LocalScannerView
      tools={discoveredTools}
      t={t}
      onAttach={(tool) => {
        setAgentName(`${tool.name}`);
        setAgentProvider(tool.id === 'codex' ? 'codex' : 'cli');
        setAgentCommand(tool.id);
        setAgentProject(projects[0]?.id || '');
        setModal('spawn');
      }}
      onRescan={() => refresh(true)}
      busy={busy}
    />
  ) : page === 'Approvals' ? (
    <ApprovalsView
      approvals={pendingApprovals}
      workspaceFor={agentWorkspace}
      t={t}
      onOpenAgent={(id) => setSelectedId(id)}
      onRespond={(ag, apprId, dec) => act(ag, 'approval', { requestId: apprId, decision: dec })}
      busy={busy}
    />
  ) : page === 'Telemetry' ? (
    <TelemetryView
      metrics={systemMetrics}
      agents={agents}
      projects={projects}
      t={t}
      onRefresh={() => refresh(true)}
    />
  ) : page === 'Workspaces' ? (
    <WorkspacesView
      projects={projects}
      agents={agents}
      t={t}
      onAdd={() => setModal('project')}
      onOpen={(id) => { setWorkspaceFilter(id); setPage('Agents'); }}
      now={now}
    />
  ) : (
    <SettingsView
      health={health}
      projects={projects}
      agents={agents}
      lang={lang}
      soundOn={soundOn}
      t={t}
      onToggleLang={toggleLanguage}
      onToggleSound={toggleSound}
      onAddProject={() => setModal('project')}
      onRefresh={() => refresh(true)}
      loading={loading}
    />
  );

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Command size={18}/></div>
          <span>AgentHub</span>
          <span className="brand-local">MISSION CTRL</span>
        </div>

        <div className="workspace-switcher">
          <div className="switcher-glyph">OS</div>
          <div className="switcher-copy">
            <b>{projects[0]?.name || 'Local Host'}</b>
            <span>{systemMetrics?.os?.platform === 'win32' ? 'Windows Host' : 'Unix Host'}</span>
          </div>
          <ChevronDown size={14} color="var(--text-faint)"/>
        </div>

        <div className="side-label">OPERATIONS</div>
        <nav className="primary-nav">
          {navigation.map(({ id, label, icon: Icon, count, alert }) => (
            <button
              key={id}
              className={`nav-link ${!selectedAgent && page === id ? 'is-active' : ''}`}
              onClick={() => { setPage(id); setSelectedId(null); setSidebarOpen(false); sfx.playClick(); }}
            >
              <Icon size={16}/>
              <span>{label}</span>
              {count !== undefined && count > 0 && (
                <span className={`nav-count ${alert ? '' : 'subtle-count'}`}>{count}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="side-label workspace-label">
          {t.nav.workspaces.toUpperCase()}
          <button onClick={() => setModal('project')} title={t.workspaces.addWorkspace}><Plus size={14}/></button>
        </div>
        <div className="sidebar-workspaces">
          {projects.map((p) => (
            <button key={p.id} onClick={() => { setWorkspaceFilter(p.id); setPage('Agents'); setSelectedId(null); }}>
              <span className="workspace-bullet" style={{ '--project-color': p.color || '#6366f1' }}/>
              <span>{p.name}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="provider-stack">
            <div className="provider-row">
              <span className="provider-indicator available"/>
              <span>CLI Generic Bridge</span>
              <span className="provider-state">Online</span>
            </div>
            <div className="provider-row">
              <span className={`provider-indicator ${health?.providers?.codex ? 'available' : 'unavailable'}`}/>
              <span>Codex App-Server</span>
              <span className="provider-state">{health?.providers?.codex ? 'Ready' : 'CLI not found'}</span>
            </div>
          </div>
          <div className="bridge-status">
            <span className={`bridge-dot ${health?.ok ? 'available' : ''}`}/>
            <span>{health?.ok ? 'Local Bridge Linked (127.0.0.1)' : 'Connecting Bridge...'}</span>
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)}/>}

      {/* Main Mission Control Column */}
      <main className="main-column">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)}><Menu size={18}/></button>

          <div className="breadcrumb">
            <span>AgentHub</span>
            <ChevronLeft size={13}/>
            <b>{selectedAgent ? selectedAgent.name : navigation.find((n) => n.id === page)?.label || page}</b>
          </div>

          <div className="topbar-search">
            <Search size={14} className="search-icon"/>
            <input
              id="global-search-input"
              type="text"
              placeholder={t.topbar.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="search-kbd">Ctrl+K</span>
          </div>

          <div className="topbar-right">
            <button className="pitch-badge-btn" onClick={() => setPitchOpen(true)}>
              <Sparkles size={13}/>
              <span>{t.topbar.pitchMode}</span>
            </button>

            <button className="button secondary" onClick={() => setModal('snapshot')} title="Quick Git Snapshot">
              <GitBranch size={13}/>
              <span>{t.topbar.quickSnapshot}</span>
            </button>

            <button className="button primary" onClick={() => { setAgentProject(projects[0]?.id || ''); setModal('spawn'); }}>
              <Plus size={14}/>
              <span>{t.topbar.spawnAgent}</span>
            </button>

            <button className="icon-button" onClick={toggleLanguage} title={`Language: ${lang.toUpperCase()}`}>
              <Globe size={15}/>
            </button>

            <button className="icon-button" onClick={toggleSound} title={soundOn ? 'Mute SFX' : 'Enable SFX'}>
              {soundOn ? <Volume2 size={15}/> : <VolumeX size={15}/>}
            </button>

            <button className="icon-button" onClick={() => refresh(true)} title={t.topbar.refresh}>
              <RefreshCw size={14} className={loading ? 'spin' : ''}/>
            </button>
          </div>
        </header>

        <section className="page-content">
          {error && (
            <div className="error-banner" style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertCircle size={16} color="var(--accent-rose)"/>
              <span style={{ color: '#fb7185', fontSize: '0.85rem' }}>{error}</span>
              <button className="quiet-button" style={{ marginLeft: 'auto' }} onClick={() => setError('')}><X size={14}/></button>
            </div>
          )}
          {loading && !agents.length && !projects.length ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
              <LoaderCircle size={28} className="spin" color="var(--accent-primary)"/>
              <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Initializing AgentHub Mission Control...</p>
            </div>
          ) : content}
        </section>
      </main>

      {/* Modals */}
      {pitchOpen && <PitchModal t={t} onClose={() => setPitchOpen(false)}/>}

      {modal === 'spawn' && (
        <SpawnAgentModal
          projects={projects}
          agentName={agentName}
          agentProvider={agentProvider}
          agentProject={agentProject}
          agentCommand={agentCommand}
          busy={busy}
          t={t}
          onClose={() => setModal('')}
          onName={setAgentName}
          onProvider={setAgentProvider}
          onProject={setAgentProject}
          onCommand={setAgentCommand}
          onSubmit={handleSpawnAgent}
        />
      )}

      {modal === 'task' && (
        <TaskModal
          agent={taskAgent}
          text={taskText}
          busy={busy}
          t={t}
          onClose={() => setModal('')}
          onText={setTaskText}
          onSubmit={handleAssignTask}
        />
      )}

      {modal === 'project' && (
        <ProjectModal
          name={projectName}
          path={projectPath}
          busy={busy}
          t={t}
          onClose={() => setModal('')}
          onName={setProjectName}
          onPath={setProjectPath}
          onSubmit={handleCreateProject}
        />
      )}

      {modal === 'snapshot' && (
        <SnapshotModal
          message={snapshotMsg}
          gitStatus={gitStatus}
          busy={busy}
          t={t}
          onClose={() => setModal('')}
          onMessage={setSnapshotMsg}
          onSubmit={triggerInstantSnapshot}
        />
      )}
    </div>
  );
}

// ---------------- VIEWS ----------------

function DashboardView({ agents, projects, events, counts, systemMetrics, gitStatus, pendingApprovals, swarmRuns, workspaceFor, t, onNavigate, onOpenAgent, onOpenWorkspace, onTask, onAction, onSpawn, onSnapshot, onRunSwarm, busy, now }) {
  const activeAgents = agents.filter((a) => ['working', 'waiting'].includes(a.status));
  const activeSwarm = swarmRuns.find((r) => r.status === 'running');

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t.dashboard.eyebrow}</div>
          <h1>{t.dashboard.title}</h1>
          <p>{t.dashboard.description}</p>
        </div>
        <div className="page-actions">
          <button className="button secondary" onClick={onSnapshot}>
            <GitBranch size={14}/>
            <span>{t.dashboard.triggerBackup}</span>
          </button>
          <button className="button primary" onClick={onSpawn}>
            <Plus size={14}/>
            <span>{t.topbar.spawnAgent}</span>
          </button>
        </div>
      </div>

      {/* Telemetry Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon purple"><Bot size={20}/></div>
          <div className="stat-copy">
            <span>{t.dashboard.statActive}</span>
            <strong>{counts.active} / {agents.length}</strong>
            <small>{counts.working} executing · {counts.waiting} paused</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon cyan"><Cpu size={20}/></div>
          <div className="stat-copy">
            <span>CPU & Memory Load</span>
            <strong>{systemMetrics?.cpu?.percent || 12}% CPU</strong>
            <small>{systemMetrics?.memory?.usedGb || '4.2'} GB / {systemMetrics?.memory?.totalGb || '16'} GB RAM</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><Activity size={20}/></div>
          <div className="stat-copy">
            <span>{t.dashboard.statTokens}</span>
            <strong>{counts.totalTokens.toLocaleString()}</strong>
            <small>~${(counts.totalTokens / 1000 * 0.003).toFixed(3)} est. API cost</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue"><GitBranch size={20}/></div>
          <div className="stat-copy">
            <span>{t.dashboard.statGit}</span>
            <strong>{gitStatus?.branch || 'main'}</strong>
            <small>{gitStatus?.clean ? '100% Synced / Clean' : `${gitStatus?.totalChanges || 0} uncommitted diffs`}</small>
          </div>
        </div>
      </div>

      {/* Pending Approvals Alert Banner */}
      {pendingApprovals.length > 0 && (
        <section className="surface" style={{ borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.06)', marginBottom: '1.25rem' }}>
          <div className="section-header">
            <h2 style={{ color: '#fbbf24' }}>
              <ShieldCheck size={18}/>
              <span>{t.dashboard.approvalsTitle} ({pendingApprovals.length})</span>
            </h2>
            <button className="quiet-button" onClick={() => onNavigate('Approvals')}>View all <ArrowUpRight size={13}/></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {pendingApprovals.map(({ agent, approval }) => (
              <div key={approval.requestId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <b style={{ color: '#fff', fontSize: '0.85rem' }}>{agent.name}</b>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{approval.summary}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="button danger" onClick={() => onAction(agent, 'approval', { requestId: approval.requestId, decision: 'decline' })}>Deny</button>
                  <button className="button primary" onClick={() => onAction(agent, 'approval', { requestId: approval.requestId, decision: 'accept' })}><Check size={13}/> Authorize</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Swarm Card */}
      {activeSwarm && (
        <section className="surface" style={{ borderColor: 'rgba(99,102,241,0.4)', marginBottom: '1.25rem', background: 'rgba(99,102,241,0.06)' }}>
          <div className="section-header">
            <h2 style={{ color: 'var(--accent-primary)' }}>
              <Layers size={18}/>
              <span>Active Swarm: {activeSwarm.name}</span>
            </h2>
            <button className="quiet-button" onClick={() => onNavigate('Swarm')}>Swarm Studio <ArrowUpRight size={13}/></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Step {activeSwarm.currentStepIndex + 1}/{activeSwarm.totalSteps}: <b>{activeSwarm.steps[activeSwarm.currentStepIndex]?.name}</b>
            </span>
            <div style={{ flex: 1, minWidth: '180px', height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${((activeSwarm.currentStepIndex + 1) / activeSwarm.totalSteps) * 100}%`, height: '100%', background: 'var(--accent-primary)', transition: 'width 0.4s' }}/>
            </div>
          </div>
        </section>
      )}

      <div className="dashboard-layout">
        {/* Left Column: Active Fleet & Quick Actions */}
        <section className="surface">
          <div className="section-header">
            <h2>{t.dashboard.activeAgentsTitle} <span className="section-count">{activeAgents.length}</span></h2>
            <button className="quiet-button" onClick={() => onNavigate('Agents')}>All fleet <ArrowUpRight size={13}/></button>
          </div>

          {activeAgents.length ? (
            <div className="compact-agent-list">
              {activeAgents.map((ag) => (
                <div key={ag.id} className="agent-row">
                  <button className="agent-row-main" onClick={() => onOpenAgent(ag.id)}>
                    <span className={`agent-glyph ${ag.status}`}><Bot size={18}/></span>
                    <span className="agent-row-copy">
                      <span className="agent-row-title">
                        <b>{ag.name}</b>
                        <span className={`status-badge ${ag.status}`}><i/>{ag.status}</span>
                      </span>
                      <span className="agent-row-task">{ag.currentTask || 'Idle'}</span>
                      <span className="agent-row-meta">
                        <span className={`provider-label ${ag.provider}`}>{ag.provider.toUpperCase()}</span>
                        <span>{ag.model || 'CLI'}</span>
                        <span>Updated {ago(ag.lastActivity)}</span>
                      </span>
                    </span>
                  </button>
                  <div className="agent-row-actions">
                    <button className="icon-button" title="Open Studio" onClick={() => onOpenAgent(ag.id)}><ArrowUpRight size={14}/></button>
                    <button className="icon-button" title="Send Task" onClick={() => onTask(ag)}><Send size={14}/></button>
                    {ag.status === 'working' ? (
                      <button className="icon-button danger-action" title="Stop Process" onClick={() => onAction(ag, 'stop')}><Square size={12}/></button>
                    ) : (
                      <button className="icon-button" title="Start Process" onClick={() => onAction(ag, 'start')}><Play size={13}/></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              <Bot size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }}/>
              <p>No agents currently running.</p>
              <button className="button secondary" style={{ marginTop: '0.75rem' }} onClick={onSpawn}>+ Spawn an Agent</button>
            </div>
          )}
        </section>

        {/* Right Column: Recent Activity Log */}
        <section className="surface">
          <div className="section-header">
            <h2>{t.dashboard.recentActivityTitle}</h2>
            <span className="live-dot"/>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '420px', overflowY: 'auto' }}>
            {events.slice(0, 8).map((ev) => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span className={`status-badge ${ev.type}`} style={{ padding: '2px 5px', fontSize: '0.65rem' }}>{ev.type}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: '#cbd5e1' }}>{ev.message}</span>
                  <div style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}>{formatDate(ev.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function AgentFleetView({ agents, projects, filterProject, searchQuery, t, onClearProject, onOpen, onTask, onAction, onSpawn, busy, now }) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [providerFilter, setProviderFilter] = useState('All');

  const filtered = agents.filter((ag) => {
    if (statusFilter !== 'All' && ag.status !== statusFilter.toLowerCase()) return false;
    if (providerFilter !== 'All' && ag.provider !== providerFilter.toLowerCase()) return false;
    if (filterProject && ag.project !== filterProject) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return ag.name.toLowerCase().includes(q) || (ag.currentTask || '').toLowerCase().includes(q) || (ag.model || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t.agents.eyebrow}</div>
          <h1>{t.agents.title}</h1>
          <p>{t.agents.description}</p>
        </div>
        <div className="page-actions">
          <button className="button primary" onClick={onSpawn}>
            <Plus size={14}/>
            <span>{t.agents.addAgent}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--bg-surface)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          {['All', 'Working', 'Waiting', 'Idle', 'Done', 'Stopped'].map((st) => (
            <button
              key={st}
              style={{
                background: statusFilter === st ? 'var(--bg-surface-elevated)' : 'transparent',
                color: statusFilter === st ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-surface)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginLeft: 'auto' }}>
          {['All', 'CLI', 'Codex', 'Mock'].map((pr) => (
            <button
              key={pr}
              style={{
                background: providerFilter === pr ? 'var(--bg-surface-elevated)' : 'transparent',
                color: providerFilter === pr ? 'var(--accent-cyan)' : 'var(--text-muted)',
                border: 'none',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
              onClick={() => setProviderFilter(pr)}
            >
              {pr}
            </button>
          ))}
        </div>
      </div>

      {/* Fleet Table */}
      {filtered.length ? (
        <div className="agent-table-wrap">
          <table className="agent-table">
            <thead>
              <tr>
                <th>{t.agents.colAgent}</th>
                <th>{t.agents.colProvider}</th>
                <th>{t.agents.colWorkspace}</th>
                <th>{t.agents.colStatus}</th>
                <th>{t.agents.colTokens}</th>
                <th>{t.agents.colActivity}</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ag) => (
                <tr key={ag.id}>
                  <td>
                    <button className="table-agent" onClick={() => onOpen(ag.id)}>
                      <span className={`agent-glyph ${ag.status}`}><Bot size={16}/></span>
                      <div>
                        <b>{ag.name}</b>
                        <small>{ag.currentTask || 'Idle'}</small>
                      </div>
                    </button>
                  </td>
                  <td>
                    <span className={`provider-label ${ag.provider}`}>{ag.provider.toUpperCase()}</span>
                  </td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)' }}>
                      <FolderOpen size={13}/>
                      <span>{projects.find((p) => p.id === ag.project)?.name || 'Local'}</span>
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${ag.status}`}><i/>{ag.status}</span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                      {(ag.metrics?.tokens || (ag.progress * 120)).toLocaleString()} tkn
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-faint)', fontSize: '0.78rem' }}>
                    {ago(ag.lastActivity)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <button className="icon-button" title="Open Studio" onClick={() => onOpen(ag.id)}><ArrowUpRight size={14}/></button>
                      <button className="icon-button" title="Assign Task" onClick={() => onTask(ag)}><Send size={14}/></button>
                      {ag.status === 'working' ? (
                        <button className="icon-button danger-action" title="Stop Process" onClick={() => onAction(ag, 'stop')}><Square size={12}/></button>
                      ) : (
                        <button className="icon-button" title="Start Process" onClick={() => onAction(ag, 'start')}><Play size={13}/></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'var(--bg-surface)', borderRadius: '12px' }}>
          <Bot size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }}/>
          <h3>{t.agents.noAgents}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{t.agents.noAgentsDesc}</p>
          <button className="button primary" style={{ marginTop: '1rem' }} onClick={onSpawn}>+ {t.agents.addAgent}</button>
        </div>
      )}
    </>
  );
}

function AgentStudio({ agent, workspace, busy, now, t, onBack, onAction, onApproval, onSubmitTask, onSendStdin }) {
  const [taskInput, setTaskInput] = useState('');
  const [stdinInput, setStdinInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalRef = useRef(null);

  const logs = [...(agent.logs || [])].reverse();

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs.length, autoScroll]);

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!taskInput.trim() || busy) return;
    const ok = await onSubmitTask(taskInput.trim());
    if (ok) setTaskInput('');
  };

  const handleStdinSubmit = async (e) => {
    e.preventDefault();
    if (!stdinInput.trim() || busy) return;
    await onSendStdin(stdinInput.trim());
    setStdinInput('');
  };

  const copyTerminalLogs = () => {
    const text = logs.map((l) => `[${l.at}] [${l.source || l.level}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    sfx.playSuccess();
  };

  return (
    <div className="agent-detail-page">
      <button className="back-link" onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', marginBottom: '1rem', fontWeight: 600 }}>
        <ChevronLeft size={14}/> {t.detail.back}
      </button>

      {/* Header */}
      <div className="detail-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className={`agent-glyph ${agent.status}`} style={{ width: '48px', height: '48px' }}><Bot size={24}/></span>
          <div>
            <div className="eyebrow">{t.detail.eyebrow}</div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>{agent.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '4px' }}>
              <span className={`provider-label ${agent.provider}`}>{agent.provider.toUpperCase()}</span>
              <span className={`status-badge ${agent.status}`}><i/>{agent.status}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>PID: {agent.processId || 'Idle'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {agent.status === 'working' ? (
            <button className="button danger" onClick={() => onAction(agent, 'stop')} disabled={busy}>
              <Square size={13}/> {t.detail.stop}
            </button>
          ) : (
            <button className="button primary" onClick={() => onAction(agent, 'start')} disabled={busy}>
              <Play size={13}/> {t.detail.start}
            </button>
          )}
        </div>
      </div>

      {/* Detail Metadata Summary */}
      <div className="detail-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'var(--bg-surface)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
        <div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{t.detail.workspace}</span>
          <b style={{ display: 'block', color: '#fff', fontSize: '0.85rem' }}>{workspace?.name || 'Local'}</b>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>{agent.workspace || workspace?.path}</small>
        </div>

        <div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{t.detail.currentTask}</span>
          <b style={{ display: 'block', color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>{agent.currentTask || 'Standing by'}</b>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{agent.model || 'CLI process'}</small>
        </div>

        <div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{t.detail.tokensUsed}</span>
          <b style={{ display: 'block', color: 'var(--accent-emerald)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
            {(agent.metrics?.tokens || (agent.progress * 120)).toLocaleString()} tokens
          </b>
          <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Speed: {agent.metrics?.speedTps || '62.4'} tps</small>
        </div>
      </div>

      {/* Terminal View */}
      <div className="terminal-panel">
        <div className="terminal-header">
          <div className="terminal-title">
            <Terminal size={15}/>
            <b>{t.detail.terminalTitle}</b>
            <span className="terminal-path">{agent.workspace || 'local STDIO'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button className="quiet-button" onClick={() => setAutoScroll(!autoScroll)} style={{ fontSize: '0.72rem' }}>
              Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
            </button>
            <button className="icon-button" onClick={copyTerminalLogs} title={t.detail.copyLogs}><Copy size={13}/></button>
          </div>
        </div>

        <div className="terminal-body" ref={terminalRef}>
          {logs.length ? (
            logs.map((l) => (
              <div key={l.id} className="terminal-line">
                <time>{new Date(l.at).toLocaleTimeString()}</time>
                <span className={`log-source ${l.source || l.level || 'info'}`}>{l.source || l.level}</span>
                <span className="terminal-text">{l.message}</span>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-faint)' }}>
              <Terminal size={24} style={{ opacity: 0.3, marginBottom: '0.5rem' }}/>
              <p>{t.detail.terminalEmpty}</p>
            </div>
          )}
        </div>

        {/* Stdin Interactive Input */}
        {agent.provider === 'cli' && agent.status === 'working' && (
          <form onSubmit={handleStdinSubmit} style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem', background: '#070a10', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', paddingTop: '4px' }}>&gt;</span>
            <input
              type="text"
              placeholder={t.detail.stdinPlaceholder}
              value={stdinInput}
              onChange={(e) => setStdinInput(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
            />
            <button className="button primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} type="submit">{t.detail.sendStdin}</button>
          </form>
        )}

        {/* Task Composer */}
        <form className="task-composer" onSubmit={handleTaskSubmit}>
          <div className="composer-input-wrap">
            <textarea
              rows="2"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder={t.detail.sendPlaceholder}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form.requestSubmit();
                }
              }}
            />
            <div className="composer-hint">
              <span>{agent.provider === 'cli' ? 'Streams directly to local CLI process' : 'Simulated execution pass'}</span>
              <span>Enter to send · Shift+Enter for newline</span>
            </div>
          </div>
          <button className="button primary send-button" type="submit" disabled={!taskInput.trim() || busy}>
            <Send size={14}/> {t.detail.sendButton}
          </button>
        </form>
      </div>
    </div>
  );
}

function SwarmView({ templates, runs, projects, t, onRunSwarm, busy }) {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t.swarms.eyebrow}</div>
          <h1>{t.swarms.title}</h1>
          <p>{t.swarms.description}</p>
        </div>
      </div>

      <div className="swarm-grid">
        {templates.map((tpl) => (
          <div key={tpl.id} className="swarm-card">
            <div>
              <span className="eyebrow">{tpl.category}</span>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{tpl.name}</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{tpl.description}</p>
            </div>

            <div className="swarm-timeline">
              {tpl.steps.map((st) => (
                <div key={st.id} className="swarm-step">
                  <div className="step-node"/>
                  <div>
                    <b style={{ fontSize: '0.8rem', color: '#fff' }}>{st.name}</b>
                    <small style={{ display: 'block', color: 'var(--accent-cyan)', fontSize: '0.7rem' }}>{st.role}</small>
                  </div>
                </div>
              ))}
            </div>

            <button className="button primary" style={{ marginTop: 'auto' }} onClick={() => onRunSwarm(tpl.id)} disabled={busy}>
              <Play size={13}/> {t.swarms.startSwarm}
            </button>
          </div>
        ))}
      </div>

      {/* Swarm Runs Stream */}
      {runs.length > 0 && (
        <section className="surface" style={{ marginTop: '1.5rem' }}>
          <div className="section-header">
            <h2>{t.swarms.activeRuns}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {runs.map((r) => (
              <div key={r.id} style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div>
                    <b style={{ color: '#fff', fontSize: '0.95rem' }}>{r.name}</b>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>Target: {r.projectName}</span>
                  </div>
                  <span className={`status-badge ${r.status}`}><i/>{r.status}</span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  {r.steps.map((st, i) => (
                    <div key={st.id} style={{ flex: 1, minWidth: '120px', padding: '0.5rem', background: 'var(--bg-surface-elevated)', borderRadius: '6px', border: st.status === 'running' ? '1px solid var(--accent-emerald)' : '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>Step {i + 1}</span>
                      <b style={{ display: 'block', fontSize: '0.75rem', color: st.status === 'completed' ? 'var(--accent-cyan)' : '#fff' }}>{st.role}</b>
                    </div>
                  ))}
                </div>

                <div style={{ background: '#070a10', padding: '0.6rem 0.8rem', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#cbd5e1', maxHeight: '120px', overflowY: 'auto' }}>
                  {r.logs.map((lg, i) => <div key={i}>{lg}</div>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function GitBackupView({ gitStatus, projects, t, onSnapshot, onRefresh, busy }) {
  const [diffText, setDiffText] = useState('');

  useEffect(() => {
    api('/api/git/diff').then((res) => setDiffText(res.diff || '')).catch(() => {});
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t.git.eyebrow}</div>
          <h1>{t.git.title}</h1>
          <p>{t.git.description}</p>
        </div>
        <div className="page-actions">
          <button className="button primary" onClick={onSnapshot} disabled={busy}>
            <GitBranch size={14}/> {t.git.createSnapshot}
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon purple"><GitBranch size={20}/></div>
          <div className="stat-copy">
            <span>{t.git.branch}</span>
            <strong>{gitStatus?.branch || 'main'}</strong>
            <small>{gitStatus?.remoteUrl || 'https://github.com/Zeki-wq/AgentHub.git'}</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><Check size={20}/></div>
          <div className="stat-copy">
            <span>Status</span>
            <strong>{gitStatus?.clean ? t.git.clean : t.git.dirty}</strong>
            <small>{gitStatus?.totalChanges || 0} modified files</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon cyan"><HardDrive size={20}/></div>
          <div className="stat-copy">
            <span>Local Worktrees</span>
            <strong>{projects.length} connected</strong>
            <small>Auto-snapshot enabled</small>
          </div>
        </div>
      </div>

      {/* Diff Inspector */}
      <section className="surface" style={{ marginTop: '1.5rem' }}>
        <div className="section-header">
          <h2>{t.git.diffViewer}</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>git diff HEAD</span>
        </div>
        {diffText ? (
          <div className="diff-box">
            {diffText.split('\n').map((l, i) => (
              <div key={i} className={l.startsWith('+') ? 'diff-add' : l.startsWith('-') ? 'diff-del' : ''}>
                {l}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-faint)' }}>
            <Check size={24} style={{ color: 'var(--accent-emerald)', marginBottom: '0.5rem' }}/>
            <p>{t.git.noDiff}</p>
          </div>
        )}
      </section>
    </>
  );
}

function LocalScannerView({ tools, t, onAttach, onRescan, busy }) {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t.scanner.eyebrow}</div>
          <h1>{t.scanner.title}</h1>
          <p>{t.scanner.description}</p>
        </div>
        <div className="page-actions">
          <button className="button secondary" onClick={onRescan} disabled={busy}>
            <RefreshCw size={14} className={busy ? 'spin' : ''}/> {t.scanner.rescan}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {tools.map((tool) => (
          <div key={tool.id} className="surface" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span className={`provider-indicator ${tool.available ? 'available' : 'unavailable'}`}/>
                <b style={{ color: '#fff', fontSize: '0.95rem' }}>{tool.name}</b>
              </div>
              <span className={`status-badge ${tool.available ? 'done' : 'stopped'}`} style={{ fontSize: '0.68rem' }}>
                {tool.available ? t.scanner.detected : t.scanner.notFound}
              </span>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{tool.description}</p>

            {tool.available && (
              <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', background: 'var(--bg-surface-elevated)', padding: '4px 8px', borderRadius: '4px' }}>
                {tool.version}
              </div>
            )}

            <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
              {tool.available ? (
                <button className="button primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onAttach(tool)}>
                  <Plus size={13}/> {t.scanner.spawnFromTool}
                </button>
              ) : (
                <a href={tool.docsUrl} target="_blank" rel="noreferrer" className="button secondary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
                  <ExternalLink size={13}/> Docs & Setup
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ApprovalsView({ approvals, workspaceFor, t, onOpenAgent, onRespond, busy }) {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t.approvals.eyebrow}</div>
          <h1>{t.approvals.title}</h1>
          <p>{t.approvals.description}</p>
        </div>
      </div>

      {approvals.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {approvals.map(({ agent, approval }) => (
            <div key={approval.requestId} className="surface" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', borderColor: 'rgba(245,158,11,0.3)' }}>
              <div>
                <span className="eyebrow" style={{ color: 'var(--accent-amber)' }}>{approval.method || 'Security Guardrail'}</span>
                <h3 style={{ fontSize: '1.1rem', color: '#fff', marginTop: '2px' }}>{agent.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>{approval.summary}</p>
                <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.6rem' }}>
                  <span>Workspace: <b>{agent.workspace}</b></span>
                  <span>Requested: {formatDate(approval.createdAt)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button className="button danger" onClick={() => onRespond(agent, approval.requestId, 'decline')} disabled={busy}>
                  {t.approvals.deny}
                </button>
                <button className="button primary" onClick={() => onRespond(agent, approval.requestId, 'accept')} disabled={busy}>
                  <Check size={14}/> {t.approvals.approve}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'var(--bg-surface)', borderRadius: '12px' }}>
          <ShieldCheck size={36} style={{ color: 'var(--accent-emerald)', marginBottom: '0.75rem' }}/>
          <h3>{t.approvals.noApprovals}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{t.approvals.noApprovalsDesc}</p>
        </div>
      )}
    </>
  );
}

function TelemetryView({ metrics, agents, projects, t, onRefresh }) {
  const exportState = async () => {
    window.location.href = '/api/backup/export';
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t.telemetry.eyebrow}</div>
          <h1>{t.telemetry.title}</h1>
          <p>{t.telemetry.description}</p>
        </div>
        <div className="page-actions">
          <button className="button secondary" onClick={exportState}>
            <Download size={14}/> {t.telemetry.exportAudit}
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon purple"><Cpu size={20}/></div>
          <div className="stat-copy">
            <span>{t.telemetry.cpuLoad}</span>
            <strong>{metrics?.cpu?.percent || 14}%</strong>
            <small>{metrics?.cpu?.cores || 8} Logical Cores ({metrics?.cpu?.model || 'CPU'})</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon cyan"><HardDrive size={20}/></div>
          <div className="stat-copy">
            <span>{t.telemetry.memUsage}</span>
            <strong>{metrics?.memory?.usedGb || '4.5'} GB / {metrics?.memory?.totalGb || '16'} GB</strong>
            <small>{metrics?.memory?.percent || 30}% Allocated</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><Activity size={20}/></div>
          <div className="stat-copy">
            <span>Fleet Throughput</span>
            <strong>{metrics?.fleet?.estimatedTokens?.toLocaleString() || '48,200'}</strong>
            <small>~${metrics?.fleet?.estimatedCostUsd || '0.144'} Est. Cost</small>
          </div>
        </div>
      </div>
    </>
  );
}

function WorkspacesView({ projects, agents, t, onAdd, onOpen, now }) {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">{t.workspaces.eyebrow}</div>
          <h1>{t.workspaces.title}</h1>
          <p>{t.workspaces.description}</p>
        </div>
        <div className="page-actions">
          <button className="button primary" onClick={onAdd}>
            <Plus size={14}/> {t.workspaces.addWorkspace}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
        {projects.map((p) => {
          const assigned = agents.filter((a) => a.project === p.id);
          return (
            <div key={p.id} className="surface" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="workspace-bullet" style={{ '--project-color': p.color || '#6366f1', width: '12px', height: '12px' }}/>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>{assigned.length} agents</span>
              </div>
              <h2 style={{ fontSize: '1.2rem', color: '#fff' }}>{p.name}</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{p.path}</p>
              <button className="button secondary" style={{ marginTop: 'auto' }} onClick={() => onOpen(p.id)}>
                {t.workspaces.openInFleet} <ArrowUpRight size={13}/>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SettingsView({ health, projects, agents, lang, soundOn, t, onToggleLang, onToggleSound, onAddProject, onRefresh, loading }) {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">CONFIG</div>
          <h1>Settings & Localization</h1>
          <p>Mission control bridge configuration and preferences.</p>
        </div>
      </div>

      <div className="surface" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '640px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <b>Language / Dil</b>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Turkish / English interface localization</p>
          </div>
          <button className="button secondary" onClick={onToggleLang}>
            <Globe size={14}/> {lang === 'en' ? 'Türkçe\'ye Geç' : 'Switch to English'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <b>Mission Control Audio FX</b>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Synthesized Web Audio clicks & alerts</p>
          </div>
          <button className="button secondary" onClick={onToggleSound}>
            {soundOn ? <Volume2 size={14}/> : <VolumeX size={14}/>} {soundOn ? 'Enabled' : 'Muted'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <b>GitHub Remote Repository</b>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>https://github.com/Zeki-wq/AgentHub.git</p>
          </div>
          <a href="https://github.com/Zeki-wq/AgentHub.git" target="_blank" rel="noreferrer" className="button secondary">
            <ExternalLink size={13}/> GitHub
          </a>
        </div>
      </div>
    </>
  );
}

// ---------------- MODALS ----------------

function PitchModal({ t, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal pitch-modal">
        <div className="modal-header">
          <div>
            <div className="eyebrow" style={{ color: '#c084fc' }}>{t.pitch.badge}</div>
            <h2>{t.pitch.title}</h2>
            <p>{t.pitch.tagline}</p>
          </div>
          <button className="icon-button" onClick={onClose}><X size={16}/></button>
        </div>

        <div className="pitch-grid">
          <div className="pitch-card">
            <b>{t.pitch.point1Title}</b>
            <p>{t.pitch.point1Desc}</p>
          </div>
          <div className="pitch-card">
            <b>{t.pitch.point2Title}</b>
            <p>{t.pitch.point2Desc}</p>
          </div>
          <div className="pitch-card">
            <b>{t.pitch.point3Title}</b>
            <p>{t.pitch.point3Desc}</p>
          </div>
          <div className="pitch-card">
            <b>{t.pitch.point4Title}</b>
            <p>{t.pitch.point4Desc}</p>
          </div>
        </div>

        <div className="modal-actions">
          <button className="button primary" onClick={onClose}>{t.pitch.closeButton}</button>
        </div>
      </div>
    </div>
  );
}

function SpawnAgentModal({ projects, agentName, agentProvider, agentProject, agentCommand, busy, t, onClose, onName, onProvider, onProject, onCommand, onSubmit }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="eyebrow">PROCESS REGISTRATION</div>
            <h2>{t.agents.addAgent}</h2>
            <p>Connect a local AI agent process to AgentHub Mission Control.</p>
          </div>
          <button className="icon-button" onClick={onClose}><X size={16}/></button>
        </div>

        <form onSubmit={onSubmit}>
          <label className="field-label">
            Agent Name
            <input value={agentName} onChange={(e) => onName(e.target.value)} placeholder="e.g. Claude Code Refactorer" required/>
          </label>

          <label className="field-label">
            Provider Type
            <select value={agentProvider} onChange={(e) => onProvider(e.target.value)}>
              <option value="cli">Generic Local CLI (Claude Code, Aider, Ollama, Python)</option>
              <option value="codex">Codex App-Server (OpenAI)</option>
              <option value="mock">Simulated / Mock Agent (Demo)</option>
            </select>
          </label>

          {agentProvider === 'cli' && (
            <label className="field-label">
              CLI Executable Command
              <input value={agentCommand} onChange={(e) => onCommand(e.target.value)} placeholder="e.g. claude, aider, ollama, python agent.py" required/>
            </label>
          )}

          <label className="field-label">
            Workspace
            <select value={agentProject} onChange={(e) => onProject(e.target.value)}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.path})</option>)}
            </select>
          </label>

          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>{t.modals.cancel}</button>
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? <LoaderCircle size={14} className="spin"/> : <Plus size={14}/>} {t.modals.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskModal({ agent, text, busy, t, onClose, onText, onSubmit }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="eyebrow">ASSIGN WORKLOAD</div>
            <h2>Task: {agent?.name}</h2>
            <p>Send instructions to this agent session.</p>
          </div>
          <button className="icon-button" onClick={onClose}><X size={16}/></button>
        </div>

        <form onSubmit={onSubmit}>
          <label className="field-label">
            Task Description
            <textarea autoFocus rows="4" value={text} onChange={(e) => onText(e.target.value)} placeholder="Describe the goal for this agent..." required/>
          </label>

          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>{t.modals.cancel}</button>
            <button type="submit" className="button primary" disabled={busy || !text.trim()}>
              {busy ? <LoaderCircle size={14} className="spin"/> : <Send size={14}/>} Send Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectModal({ name, path, busy, t, onClose, onName, onPath, onSubmit }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="eyebrow">LOCAL DIRECTORY</div>
            <h2>{t.workspaces.addWorkspace}</h2>
            <p>Connect a folder for AI agents to edit and create branches.</p>
          </div>
          <button className="icon-button" onClick={onClose}><X size={16}/></button>
        </div>

        <form onSubmit={onSubmit}>
          <label className="field-label">
            Workspace Name
            <input autoFocus value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. AgentHub Core" required/>
          </label>

          <label className="field-label">
            Absolute Folder Path
            <input value={path} onChange={(e) => onPath(e.target.value)} placeholder="e.g. c:/Users/Zeki/AgentHub" required/>
          </label>

          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>{t.modals.cancel}</button>
            <button type="submit" className="button primary" disabled={busy || !name.trim() || !path.trim()}>
              {busy ? <LoaderCircle size={14} className="spin"/> : <Plus size={14}/>} {t.workspaces.addWorkspace}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SnapshotModal({ message, gitStatus, busy, t, onClose, onMessage, onSubmit }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="eyebrow">GIT VERSION CHECKPOINT</div>
            <h2>{t.git.createSnapshot}</h2>
            <p>Stage uncommitted files and create a signed state snapshot.</p>
          </div>
          <button className="icon-button" onClick={onClose}><X size={16}/></button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
          <label className="field-label">
            Snapshot / Commit Message
            <input autoFocus value={message} onChange={(e) => onMessage(e.target.value)} placeholder="e.g. Completed feature rollout pass" />
          </label>

          <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            <span>Target Branch: <b style={{ color: '#fff' }}>{gitStatus?.branch || 'main'}</b></span>
            <div style={{ marginTop: '4px' }}>{gitStatus?.totalChanges || 0} modified files will be staged.</div>
          </div>

          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>{t.modals.cancel}</button>
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? <LoaderCircle size={14} className="spin"/> : <GitBranch size={14}/>} {t.git.createSnapshot}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
