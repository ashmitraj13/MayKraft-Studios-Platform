import { Link } from 'react-router-dom';
import { videoApi } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { useCountdown } from '../../hooks/useCountdown';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, StatusBadge, EmptyState, ErrorState, SkeletonList, Stat } from '../../components/ui';
import { fmtDateTime } from '../../lib/format';

const GROUPS = [
  { key: 'todo', title: 'Needs you', statuses: ['assigned', 'in_progress', 'changes_requested'] },
  { key: 'review', title: 'With the studio', statuses: ['submitted', 'client_review', 'client_changes'] },
  { key: 'done', title: 'Wrapped', statuses: ['approved', 'delivered'] },
];

function Countdown({ deadline, active }) {
  const c = useCountdown(deadline);
  if (!c) return <span className="text-xs text-muted">No deadline</span>;
  const tone = !active ? 'text-muted' : c.overdue ? 'text-bad' : c.urgent ? 'text-warn' : 'text-cream-soft';
  return <span className={`font-sans font-light tracking-tight text-2xl tabular-nums ${tone}`}>{active ? c.text : fmtDateTime(deadline)}</span>;
}

function VideoCard({ v, onStart }) {
  const active = ['assigned', 'in_progress', 'changes_requested'].includes(v.status);
  return (
    <div className="card card-hover flex flex-col p-5 animate-fade-up">
      <div className="flex items-start justify-between gap-3">
        <StatusBadge status={v.status} />
        {v.versions?.length > 0 && <span className="text-[11px] text-muted">v{v.versions.length}</span>}
      </div>
      <Link to={`/editor/videos/${v._id}`} className="mt-4 font-display text-2xl leading-snug text-cream-soft transition hover:text-cream">{v.title}</Link>
      <p className="mt-1 text-xs text-muted">{v.project?.client?.company} · {v.project?.title}</p>
      <div className="mt-auto pt-6">
        <div className="eyebrow text-[9px]">Your deadline</div>
        <Countdown deadline={v.editorDeadline} active={active} />
        <div className="mt-4 flex gap-2">
          <Link to={`/editor/videos/${v._id}`} className="btn-ghost btn-sm flex-1">Open</Link>
          {v.allowedNext?.includes('in_progress') && v.status === 'assigned' && <button className="btn-primary btn-sm flex-1" onClick={() => onStart(v)}>Start work</button>}
          {v.status === 'changes_requested' && <Link to={`/editor/videos/${v._id}`} className="btn-primary btn-sm flex-1">See notes</Link>}
        </div>
      </div>
    </div>
  );
}

export default function MyVideos() {
  const { user } = useAuth();
  const toast = useToast();
  const res = useAsync(() => videoApi.list(), []);
  useSocketEvent('video_updated', () => res.reload({ silent: true }));
  useSocketEvent('feedback_added', () => res.reload({ silent: true }));

  const start = async (v) => {
    try {
      await videoApi.setStatus(v._id, { status: 'in_progress' });
      toast.success(`Started “${v.title}”`);
      res.reload({ silent: true });
    } catch (err) { toast.error(err); }
  };

  const videos = res.data || [];
  const overdue = videos.filter((v) => GROUPS[0].statuses.includes(v.status) && v.editorDeadline && new Date(v.editorDeadline) < new Date()).length;

  return (
    <>
      <PageHeader eyebrow="My videos" title={`Ready to cut, ${user.name.split(' ')[0]}?`} sub="Everything assigned to you, soonest deadline first." />
      {res.data && (
        <div className="mb-8 grid grid-cols-3 gap-3">
          <Stat label="To do" value={videos.filter((v) => GROUPS[0].statuses.includes(v.status)).length} sub={overdue ? `${overdue} overdue` : 'none overdue'} tone={overdue ? 'bad' : undefined} />
          <Stat label="In review" value={videos.filter((v) => GROUPS[1].statuses.includes(v.status)).length} />
          <Stat label="Wrapped" value={videos.filter((v) => GROUPS[2].statuses.includes(v.status)).length} tone="ok" />
        </div>
      )}
      {res.error && <ErrorState message={res.error} onRetry={res.reload} />}
      {res.loading && !res.data && <SkeletonList rows={3} className="h-40" />}
      {res.data && videos.length === 0 && <EmptyState title="Nothing assigned yet" body="When the studio assigns you a video, it’ll appear here with its footage and brief." icon="▶" />}

      <div className="space-y-10">
        {GROUPS.map((g) => {
          const list = videos.filter((v) => g.statuses.includes(v.status));
          if (!list.length) return null;
          return (
            <section key={g.key}>
              <h2 className="mb-4 text-3xl">{g.title} <span className="font-sans text-sm text-muted">({list.length})</span></h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{list.map((v) => <VideoCard key={v._id} v={v} onStart={start} />)}</div>
            </section>
          );
        })}
      </div>
    </>
  );
}
