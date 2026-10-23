import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { peopleApi, chatApi } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { useToast } from '../../context/ToastContext';
import { PageHeader, EmptyState, ErrorState, SkeletonList, Avatar } from '../../components/ui';
import { UserFormModal } from '../../components/forms';
import { useRealtime } from '../../context/RealtimeContext';

function OnTime({ pct }) {
  if (pct === null || pct === undefined) return <span className="text-muted">—</span>;
  const tone = pct >= 85 ? 'text-ok' : pct >= 60 ? 'text-warn' : 'text-bad';
  return <span className={`font-sans font-light tracking-tight text-3xl tabular-nums ${tone}`}>{pct}%</span>;
}

export default function Editors() {
  const editors = useAsync(() => peopleApi.editors(), []);
  const [creating, setCreating] = useState(false);
  const { online } = useRealtime();
  const toast = useToast();
  const navigate = useNavigate();

  const message = async (id) => {
    try {
      const { data } = await chatApi.open(id);
      navigate(`/manager/chat?c=${data._id}`);
    } catch (err) { toast.error(err); }
  };
  const toggle = async (e) => {
    try {
      await peopleApi.updateUser(e._id, { isActive: !e.isActive });
      toast.success(e.isActive ? `${e.name} deactivated` : `${e.name} reactivated`);
      editors.reload({ silent: true });
    } catch (err) { toast.error(err); }
  };

  return (
    <>
      <PageHeader eyebrow="Editors" title="The cutting room" sub="Workload, completed films and on-time rate (first cut on or before the editor deadline).">
        <button className="btn-primary btn-sm" onClick={() => setCreating(true)}>New editor</button>
      </PageHeader>
      {editors.error && <ErrorState message={editors.error} onRetry={editors.reload} />}
      {editors.loading && !editors.data && <SkeletonList rows={3} className="h-24" />}
      {editors.data?.length === 0 && <EmptyState title="No editors yet" action={<button className="btn-primary" onClick={() => setCreating(true)}>Add an editor</button>} />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(editors.data || []).map((e, i) => (
          <div key={e._id} className={`card flex flex-col p-6 animate-fade-up ${!e.isActive ? 'opacity-60' : ''}`} style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-center gap-4">
              <Avatar name={e.name} size="lg" online={online.has(e._id)} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-2xl">{e.name}</h2>
                <p className="truncate text-xs text-muted">{e.email}</p>
              </div>
            </div>
            {e.skills?.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{e.skills.map((s) => <span key={s} className="chip border-white/10 text-muted">{s}</span>)}</div>}
            <div className="mt-6 grid grid-cols-3 items-end gap-2 text-center">
              <div><div className="font-sans font-light tracking-tight text-3xl tabular-nums">{e.activeCount}</div><div className="eyebrow text-[9px]">Active</div></div>
              <div><div className="font-sans font-light tracking-tight text-3xl tabular-nums">{e.completedCount}</div><div className="eyebrow text-[9px]">Completed</div></div>
              <div><OnTime pct={e.onTimePercent} /><div className="eyebrow text-[9px]">On time</div></div>
            </div>
            <div className="mt-6 flex gap-2">
              <button className="btn-ghost btn-sm flex-1" onClick={() => message(e._id)} disabled={!e.isActive}>Message</button>
              <button className="btn-ghost btn-sm" onClick={() => toggle(e)}>{e.isActive ? 'Deactivate' : 'Reactivate'}</button>
            </div>
          </div>
        ))}
      </div>
      <UserFormModal open={creating} role="editor" onClose={() => setCreating(false)} onCreated={() => editors.reload({ silent: true })} />
    </>
  );
}
