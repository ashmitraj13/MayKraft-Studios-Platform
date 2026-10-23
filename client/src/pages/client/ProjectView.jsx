import { Link, useParams } from 'react-router-dom';
import { projectApi } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { PageHeader, ProgressBar, EmptyState, ErrorState, SkeletonList, StatusBadge } from '../../components/ui';
import StatusCounts from '../../components/video/StatusCounts';
import { fmtDate, relDays } from '../../lib/format';

export default function ProjectView() {
  const { id } = useParams();
  const res = useAsync(() => projectApi.get(id), [id]);
  useSocketEvent('video_updated', (p) => p.projectId === id && res.reload({ silent: true }));
  const p = res.data;
  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />;
  if (!p) return <SkeletonList rows={3} className="h-28" />;

  const order = { client_review: 0, approved: 1, delivered: 2 };
  const videos = [...p.videos].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <>
      <Link to="/client" className="mb-6 inline-block text-xs text-muted hover:text-cream">← Your projects</Link>
      <PageHeader eyebrow={`Due ${fmtDate(p.clientDeadline)} · ${relDays(p.clientDeadline)}`} title={p.title} sub={p.description} />
      <div className="card mb-8 grid gap-6 p-6 md:grid-cols-2 md:items-center">
        <ProgressBar value={p.progress} label="Films approved or delivered" sub={`${p.doneCount} of ${p.totalVideos}`} />
        <div className="md:justify-self-end"><StatusCounts counts={p.statusCounts} client /></div>
      </div>

      {videos.length === 0 ? (
        <EmptyState title="Your films are in production" body={`${p.statusCounts?.in_production || 0} video${p.statusCounts?.in_production === 1 ? ' is' : 's are'} being crafted. You’ll see each one here as soon as it’s ready for your review.`} icon="✦" />
      ) : (
        <div className="space-y-3">
          {videos.map((v) => (
            <Link key={v._id} to={`/client/videos/${v._id}`} className={`card card-hover flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between ${v.status === 'client_review' ? 'border-cream/25' : ''}`}>
              <div className="min-w-0">
                <h2 className="truncate text-2xl">{v.title}</h2>
                <p className="text-xs text-muted">{v.currentVersion ? `Version ${v.currentVersion}` : ''}{v.status === 'delivered' ? ' · Final files ready' : ''}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={v.status} client />
                <span className="text-sm text-cream">{v.status === 'client_review' ? 'Review →' : 'View →'}</span>
              </div>
            </Link>
          ))}
          {p.statusCounts?.in_production > 0 && <p className="pt-2 text-center text-xs text-muted">+ {p.statusCounts.in_production} more in production</p>}
        </div>
      )}
    </>
  );
}
