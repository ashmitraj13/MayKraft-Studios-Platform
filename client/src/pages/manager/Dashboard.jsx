import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi, peopleApi } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Stat, ProgressBar, EmptyState, ErrorState, Skeleton, DeadlineFlag, Avatar } from '../../components/ui';
import VideoTable from '../../components/video/VideoTable';
import StatusCounts from '../../components/video/StatusCounts';
import { STATUS, STATUS_ORDER } from '../../lib/status';
import { fmtDate, relDays, timeAgo } from '../../lib/format';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

function FlagDots({ red, amber, green }) {
  return (
    <div className="flex items-center gap-3 text-xs tabular-nums">
      <span className="flex items-center gap-1.5 text-bad"><span className="h-2 w-2 rounded-full bg-bad" />{red}</span>
      <span className="flex items-center gap-1.5 text-warn"><span className="h-2 w-2 rounded-full bg-warn" />{amber}</span>
      <span className="flex items-center gap-1.5 text-ok"><span className="h-2 w-2 rounded-full bg-ok" />{green}</span>
    </div>
  );
}

function ProjectBlock({ project, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);
  const late = new Date(project.clientDeadline) < new Date() && project.doneCount < project.totalVideos;
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-ink-950/40 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/manager/projects/${project._id}`} className="font-display text-2xl text-cream-soft transition hover:text-cream">{project.title}</Link>
            {project.status !== 'active' && <span className="chip border-white/10 text-muted">{project.status}</span>}
          </div>
          <div className="mt-1 text-xs text-muted">
            Client deadline <span className={late ? 'text-bad' : 'text-cream-soft'}>{fmtDate(project.clientDeadline)}</span> · {relDays(project.clientDeadline)}
          </div>
          <div className="mt-3"><StatusCounts counts={project.statusCounts} /></div>
        </div>
        <div className="w-full shrink-0 lg:w-64">
          <ProgressBar value={project.progress} label="Approved or delivered" sub={`${project.doneCount} / ${project.totalVideos}`} />
          <div className="mt-3 flex items-center justify-between">
            <FlagDots {...project.flagCounts} />
            <button className="text-xs text-cream/80 transition hover:text-cream" onClick={() => setOpen((o) => !o)}>
              {open ? 'Hide videos' : `Show ${project.videos.length} video${project.videos.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div className="mt-5 animate-fade-in">
          {project.videos.length ? <VideoTable videos={project.videos} /> : <p className="text-sm text-muted">No videos match the filters.</p>}
        </div>
      )}
    </div>
  );
}

function ClientCard({ row, expanded, onToggle, filtering }) {
  const { client } = row;
  return (
    <section className="card overflow-hidden animate-fade-up">
      <button onClick={onToggle} className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-white/[0.015] sm:flex-row sm:items-center sm:p-6" aria-expanded={expanded}>
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar name={client.company} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate text-3xl">{client.company}</h2>
            <div className="truncate text-xs text-muted">{client.name} · {row.projectCount} project{row.projectCount === 1 ? '' : 's'} · next deadline {fmtDate(row.nextDeadline)}</div>
          </div>
        </div>
        <div className="flex w-full items-center gap-5 sm:w-auto">
          <div className="flex-1 sm:w-48"><ProgressBar value={row.progress} size="sm" sub={`${row.doneCount}/${row.totalVideos}`} label="Overall" /></div>
          <FlagDots red={row.red} amber={row.amber} green={row.green} />
          <span className={`text-muted transition ${expanded ? 'rotate-180' : ''}`}>⌄</span>
        </div>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-white/[0.05] p-3 sm:p-5">
          {row.projects.map((p) => <ProjectBlock key={p._id} project={p} defaultOpen={filtering || p.flagCounts.red > 0} />)}
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ client: '', editor: '', status: '', overdue: false });
  const [expanded, setExpanded] = useState(null); // null = default (riskiest open)
  const params = useMemo(() => {
    const p = {};
    if (filters.client) p.client = filters.client;
    if (filters.editor) p.editor = filters.editor;
    if (filters.status) p.status = filters.status;
    if (filters.overdue) p.overdue = 'true';
    return p;
  }, [filters]);
  const filtering = Object.keys(params).length > 0;

  const dash = useAsync(() => dashboardApi.clients(params), [params]);
  const clients = useAsync(() => peopleApi.clients(), []);
  const editors = useAsync(() => peopleApi.editors(), []);

  useSocketEvent('video_updated', () => dash.reload({ silent: true }));

  const rows = dash.data || [];
  const summary = dash.meta?.summary;
  const isOpen = (id, i) => (expanded ? expanded.has(id) : filtering || i === 0 || rows[i]?.red > 0);
  const toggle = (id, i) =>
    setExpanded((prev) => {
      const base = prev || new Set(rows.filter((r, idx) => isOpen(r._id, idx)).map((r) => r._id));
      const next = new Set(base);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <>
      <PageHeader eyebrow="Client dashboard" title={`${greeting()}, ${user.name.split(' ')[0]}`} sub="Every client, project and cut — with the deadlines that matter.">
        {dash.meta && (
          <span className="chip border-white/10 text-muted" title="The dashboard is cached for 30 seconds and refreshed on any change">
            {dash.meta.fromCache ? 'Cached' : 'Live'} · {timeAgo(dash.meta.generatedAt)}
          </span>
        )}
        <button className="btn-ghost btn-sm" onClick={() => dash.reload()}>Refresh</button>
        <Link className="btn-primary btn-sm" to="/manager/clients">Clients & projects</Link>
      </PageHeader>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summary ? (
          <>
            <Stat label="Clients" value={summary.clients} sub={`${summary.projects} projects`} />
            <Stat label="Done" value={`${summary.done}`} sub={`of ${summary.totalVideos} planned`} />
            <Stat label="Your review" value={summary.awaitingReview} sub="submitted cuts" />
            <Stat label="With clients" value={summary.inClientReview} sub="in client review" />
            <Stat label="At risk" value={summary.red} tone="bad" sub={`${summary.overdue} overdue`} />
            <Stat label="Tight" value={summary.amber} tone="warn" sub="< 2 days" />
          </>
        ) : (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[98px]" />)
        )}
      </div>

      <div className="card mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-center">
        <select className="input" value={filters.client} onChange={set('client')} aria-label="Filter by client">
          <option value="">All clients</option>
          {(clients.data || []).map((c) => <option key={c._id} value={c._id}>{c.company}</option>)}
        </select>
        <select className="input" value={filters.editor} onChange={set('editor')} aria-label="Filter by editor">
          <option value="">All editors</option>
          {(editors.data || []).map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
        <select className="input" value={filters.status} onChange={set('status')} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
        </select>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 px-4 py-2.5 text-sm">
          <input type="checkbox" className="accent-[#E5604F]" checked={filters.overdue} onChange={set('overdue')} />
          Overdue only
        </label>
        <button className="btn-ghost btn-sm" disabled={!filtering} onClick={() => setFilters({ client: '', editor: '', status: '', overdue: false })}>Clear</button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><DeadlineFlag flag="green" compact /> On track</span>
        <span className="flex items-center gap-1.5"><DeadlineFlag flag="amber" compact /> Editor due within 2 days or under 2 days of buffer</span>
        <span className="flex items-center gap-1.5"><DeadlineFlag flag="red" compact /> Overdue, or editor deadline after client deadline</span>
      </div>

      {dash.error && <ErrorState message={dash.error} onRetry={dash.reload} />}
      {dash.loading && !dash.data && <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>}
      {dash.data && rows.length === 0 && (
        <EmptyState
          title={filtering ? 'Nothing matches these filters' : 'No projects yet'}
          body={filtering ? 'Try clearing a filter or two.' : 'Create a client and their first project to see it here.'}
          action={filtering ? null : <Link className="btn-primary" to="/manager/clients">Add a client</Link>}
        />
      )}
      <div className={`space-y-4 transition-opacity ${dash.loading && dash.data ? 'opacity-60' : ''}`}>
        {rows.map((row, i) => <ClientCard key={row._id} row={row} filtering={filtering} expanded={isOpen(row._id, i)} onToggle={() => toggle(row._id, i)} />)}
      </div>
    </>
  );
}
