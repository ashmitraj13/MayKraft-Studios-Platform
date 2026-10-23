import { useState } from 'react';
import { Link } from 'react-router-dom';
import { peopleApi } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader, ProgressBar, EmptyState, ErrorState, SkeletonList, Avatar } from '../../components/ui';
import { UserFormModal, ProjectFormModal } from '../../components/forms';
import { fmtDate } from '../../lib/format';

export default function Clients() {
  const clients = useAsync(() => peopleApi.clients(), []);
  const [modal, setModal] = useState(null);
  const [q, setQ] = useState('');
  const list = (clients.data || []).filter((c) => `${c.company} ${c.name} ${c.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader eyebrow="Clients" title="The roster" sub="Every brand we make films for.">
        <button className="btn-ghost btn-sm" onClick={() => setModal('project')} disabled={!clients.data?.length}>New project</button>
        <button className="btn-primary btn-sm" onClick={() => setModal('client')}>New client</button>
      </PageHeader>

      {clients.data?.length > 0 && (
        <input className="input mb-6 max-w-sm" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />
      )}

      {clients.error && <ErrorState message={clients.error} onRetry={clients.reload} />}
      {clients.loading && !clients.data && <SkeletonList rows={3} className="h-40" />}
      {clients.data && clients.data.length === 0 && (
        <EmptyState title="No clients yet" body="Create a client account — they’ll be able to log in and review their films." action={<button className="btn-primary" onClick={() => setModal('client')}>Add your first client</button>} />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c, i) => (
          <Link key={c._id} to={`/manager/clients/${c._id}`} className="card card-hover group flex flex-col p-6 animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-center gap-4">
              <Avatar name={c.company} size="lg" />
              <div className="min-w-0">
                <h2 className="truncate text-2xl transition group-hover:text-cream">{c.company}</h2>
                <p className="truncate text-xs text-muted">{c.name} · {c.email}</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center">
              <div><div className="font-sans text-3xl font-light tabular-nums tracking-tight">{c.projectCount}</div><div className="eyebrow text-[9px]">Projects</div></div>
              <div><div className="font-sans text-3xl font-light tabular-nums tracking-tight">{c.videoCount}</div><div className="eyebrow text-[9px]">Videos</div></div>
              <div><div className="font-sans text-3xl font-light tabular-nums tracking-tight">{c.activeProjects}</div><div className="eyebrow text-[9px]">Active</div></div>
            </div>
            <div className="mt-6"><ProgressBar value={c.progress} label="Delivered or approved" sub={`${c.doneCount}/${c.totalVideos}`} /></div>
            <div className="mt-4 text-xs text-muted">{c.nextDeadline ? `Next deadline ${fmtDate(c.nextDeadline)}` : 'No projects yet'}{!c.isActive && <span className="ml-2 text-bad">· deactivated</span>}</div>
          </Link>
        ))}
      </div>

      <UserFormModal open={modal === 'client'} role="client" onClose={() => setModal(null)} onCreated={() => clients.reload({ silent: true })} />
      {modal === 'project' && <ProjectFormModal open clients={clients.data} onClose={() => setModal(null)} onSaved={() => clients.reload({ silent: true })} />}
    </>
  );
}
