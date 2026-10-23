import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { projectApi } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { useToast } from '../../context/ToastContext';
import { PageHeader, ProgressBar, EmptyState, ErrorState, SkeletonList, Modal } from '../../components/ui';
import { ProjectFormModal, VideoFormModal } from '../../components/forms';
import VideoTable from '../../components/video/VideoTable';
import StatusCounts from '../../components/video/StatusCounts';
import { computeFlag } from '../../lib/status';
import { fmtDate, relDays } from '../../lib/format';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const res = useAsync(() => projectApi.get(id), [id]);
  const [modal, setModal] = useState(null);
  useSocketEvent('video_updated', (p) => p.projectId === id && res.reload({ silent: true }));

  const p = res.data;
  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />;
  if (!p) return <SkeletonList rows={4} className="h-24" />;

  const videos = p.videos.map((v) => ({ ...v, ...computeFlag(v) }));
  const remove = async () => {
    try {
      await projectApi.remove(id);
      toast.success('Project deleted');
      navigate(`/manager/clients/${p.client._id}`);
    } catch (err) { toast.error(err); }
  };

  return (
    <>
      <Link to={`/manager/clients/${p.client._id}`} className="mb-6 inline-block text-xs text-muted hover:text-cream">← {p.client.company}</Link>
      <PageHeader eyebrow={`${p.client.company} · ${p.status}`} title={p.title} sub={p.description}>
        <button className="btn-ghost btn-sm" onClick={() => setModal('edit')}>Edit</button>
        <button className="btn-danger btn-sm" onClick={() => setModal('delete')}>Delete</button>
        <button className="btn-primary btn-sm" onClick={() => setModal('video')}>Add video</button>
      </PageHeader>

      <div className="card mb-8 grid gap-6 p-6 md:grid-cols-[1fr_1fr]">
        <div>
          <div className="eyebrow">Client deadline</div>
          <div className="mt-2 font-sans text-3xl font-light tracking-tight">{fmtDate(p.clientDeadline)}</div>
          <div className="text-xs text-muted">{relDays(p.clientDeadline)}</div>
          <div className="mt-4"><StatusCounts counts={p.statusCounts} /></div>
        </div>
        <div className="self-center">
          <ProgressBar value={p.progress} label="Approved or delivered" sub={`${p.doneCount} / ${p.totalVideos} videos`} />
          <p className="mt-3 text-xs text-muted">{p.videoCount} of {p.totalVideos} planned videos added.</p>
        </div>
      </div>

      {videos.length === 0 ? (
        <EmptyState title="No videos yet" body="Add the first video with its footage link and brief, then assign an editor." action={<button className="btn-primary" onClick={() => setModal('video')}>Add a video</button>} />
      ) : (
        <div className="card p-4 sm:p-6"><VideoTable videos={videos} /></div>
      )}

      {modal === 'edit' && <ProjectFormModal open project={p} clients={[p.client]} onClose={() => setModal(null)} onSaved={() => res.reload({ silent: true })} />}
      {modal === 'video' && <VideoFormModal open projectId={id} onClose={() => setModal(null)} onSaved={() => res.reload({ silent: true })} />}
      <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Delete this project?">
        <p className="text-sm text-muted">This permanently removes <span className="text-cream-soft">{p.title}</span>, its {p.videoCount} videos and all their feedback.</p>
        <div className="mt-8 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn-danger" onClick={remove}>Delete project</button>
        </div>
      </Modal>
    </>
  );
}
