import { Link } from 'react-router-dom';
import { projectApi } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, ProgressBar, EmptyState, ErrorState, SkeletonList } from '../../components/ui';
import StatusCounts from '../../components/video/StatusCounts';
import { fmtDate, relDays } from '../../lib/format';

export default function MyProjects() {
  const { user } = useAuth();
  const res = useAsync(() => projectApi.list(), []);
  useSocketEvent('video_updated', () => res.reload({ silent: true }));
  const projects = res.data || [];
  const toReview = projects.reduce((n, p) => n + (p.statusCounts?.client_review || 0), 0);

  return (
    <>
      <PageHeader eyebrow={user.company} title="Your projects" sub={toReview ? `${toReview} video${toReview === 1 ? ' is' : 's are'} waiting for your review.` : 'Follow every film from footage to final delivery.'} />
      {res.error && <ErrorState message={res.error} onRetry={res.reload} />}
      {res.loading && !res.data && <SkeletonList rows={3} className="h-44" />}
      {res.data && projects.length === 0 && <EmptyState title="No projects yet" body="Your MayKraft producer will set up your first project shortly." />}
      <div className="grid gap-5 md:grid-cols-2">
        {projects.map((p, i) => (
          <Link key={p._id} to={`/client/projects/${p._id}`} className="card card-hover group relative flex flex-col overflow-hidden p-7 animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
            {p.statusCounts?.client_review > 0 && (
              <span className="absolute right-5 top-5 chip border-cream/40 bg-cream/10 text-cream">{p.statusCounts.client_review} to review</span>
            )}
            <div className="eyebrow">{p.status === 'active' ? 'In production' : p.status}</div>
            <h2 className="mt-3 pr-24 text-4xl leading-tight transition group-hover:text-cream">{p.title}</h2>
            {p.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{p.description}</p>}
            <div className="mt-8"><ProgressBar value={p.progress} label="Films approved or delivered" sub={`${p.doneCount} of ${p.totalVideos}`} /></div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <StatusCounts counts={p.statusCounts} client />
              <span className="text-xs text-muted">Due {fmtDate(p.clientDeadline)} · {relDays(p.clientDeadline)}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
