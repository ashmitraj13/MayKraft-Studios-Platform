import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { peopleApi, chatApi } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../context/ToastContext';
import { PageHeader, ProgressBar, EmptyState, ErrorState, SkeletonList, Stat } from '../../components/ui';
import { ProjectFormModal } from '../../components/forms';
import StatusCounts from '../../components/video/StatusCounts';
import { fmtDate, relDays } from '../../lib/format';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const res = useAsync(() => peopleApi.client(id), [id]);
  const [creating, setCreating] = useState(false);
  const c = res.data;

  const message = async () => {
    try {
      const { data } = await chatApi.open(id);
      navigate(`/manager/chat?c=${data._id}`);
    } catch (err) { toast.error(err); }
  };
  const toggleActive = async () => {
    try {
      await peopleApi.updateUser(id, { isActive: !c.isActive });
      toast.success(c.isActive ? 'Client access paused' : 'Client access restored');
      res.reload({ silent: true });
    } catch (err) { toast.error(err); }
  };

  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />;
  if (!c) return <SkeletonList rows={4} className="h-28" />;

  return (
    <>
      <Link to="/manager/clients" className="mb-6 inline-block text-xs text-muted hover:text-cream">← Clients</Link>
      <PageHeader eyebrow={`${c.name} · ${c.email}`} title={c.company}>
        <button className="btn-ghost btn-sm" onClick={toggleActive}>{c.isActive ? 'Pause access' : 'Restore access'}</button>
        <button className="btn-ghost btn-sm" onClick={message}>Message</button>
        <button className="btn-primary btn-sm" onClick={() => setCreating(true)}>New project</button>
      </PageHeader>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Projects" value={c.projectCount} sub={`${c.activeProjects} active`} />
        <Stat label="Videos planned" value={c.totalVideos} />
        <Stat label="Videos added" value={c.videoCount} />
        <Stat label="Done" value={`${c.progress}%`} sub={`${c.doneCount} approved or delivered`} tone="ok" />
      </div>

      {c.projects.length === 0 && <EmptyState title="No projects yet" body="Start their first project to begin adding footage." action={<button className="btn-primary" onClick={() => setCreating(true)}>Create a project</button>} />}
      <div className="space-y-4">
        {c.projects.map((p) => (
          <Link key={p._id} to={`/manager/projects/${p._id}`} className="card card-hover flex flex-col gap-5 p-6 animate-fade-up lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-3xl">{p.title}</h2>
                {p.status !== 'active' && <span className="chip border-white/10 text-muted">{p.status}</span>}
              </div>
              <p className="mt-1 text-xs text-muted">Client deadline {fmtDate(p.clientDeadline)} · {relDays(p.clientDeadline)}</p>
              <div className="mt-3"><StatusCounts counts={p.statusCounts} /></div>
            </div>
            <div className="w-full lg:w-72"><ProgressBar value={p.progress} label="Progress" sub={`${p.doneCount} / ${p.totalVideos}`} /></div>
          </Link>
        ))}
      </div>
      {creating && <ProjectFormModal open clients={[c]} defaultClient={c._id} onClose={() => setCreating(false)} onSaved={(p) => navigate(`/manager/projects/${p._id}`)} />}
    </>
  );
}
