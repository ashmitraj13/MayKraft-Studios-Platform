import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { videoApi, peopleApi, chatApi } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { useCountdown } from '../../hooks/useCountdown';
import { useToast } from '../../context/ToastContext';
import { ErrorState, SkeletonList, StatusBadge, Field, Spinner } from '../../components/ui';
import { Section, Brief, VersionList, FeedbackList, Timeline } from '../../components/video/parts';
import { fmtDateTime } from '../../lib/format';

function SubmitForm({ video, onDone }) {
  const toast = useToast();
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!/^https?:\/\/\S+\.\S+/.test(link.trim())) return toast.error('Paste the full review link (https://…)');
    setBusy(true);
    try {
      const res = await videoApi.submitVersion(video._id, { link: link.trim(), notes });
      toast.success(`Version ${res.data.versions.length} submitted to the studio`);
      setLink(''); setNotes('');
      onDone(res.data);
    } catch (err) { toast.error(err); } finally { setBusy(false); }
    return undefined;
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Review link" hint="Frame.io, Vimeo, YouTube (unlisted) or a Drive file">{(id) => <input id={id} className="input" placeholder="https://frame.io/…" value={link} onChange={(e) => setLink(e.target.value)} />}</Field>
      <Field label="Notes for the studio">{(id) => <textarea id={id} rows={3} className="input" placeholder="What changed, anything to watch for…" value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      <button className="btn-primary w-full sm:w-auto" disabled={busy}>{busy && <Spinner />}Submit version {video.versions.length + 1}</button>
    </form>
  );
}

export default function EditorVideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const video = useAsync(() => videoApi.get(id), [id]);
  const feedback = useAsync(() => videoApi.feedback(id), [id]);
  useSocketEvent('video_updated', (p) => { if (p.videoId === id) { video.reload({ silent: true }); feedback.reload({ silent: true }); } });
  useSocketEvent('feedback_added', (p) => p.videoId === id && feedback.reload({ silent: true }));
  const v = video.data;
  const countdown = useCountdown(v?.editorDeadline);

  if (video.error) return <ErrorState message={video.error} onRetry={video.reload} />;
  if (!v) return <SkeletonList rows={4} className="h-32" />;

  const canSubmit = ['in_progress', 'changes_requested'].includes(v.status);
  const active = ['assigned', 'in_progress', 'changes_requested'].includes(v.status);
  const openNotes = (feedback.data || []).filter((f) => !f.resolved);

  const start = async () => {
    try { const res = await videoApi.setStatus(v._id, { status: 'in_progress' }); video.setData(res.data); toast.success('Work started — good luck!'); } catch (err) { toast.error(err); }
  };
  const messageManager = async () => {
    try {
      const { data: managers } = await peopleApi.managers();
      if (!managers.length) return toast.error('No manager available');
      const { data } = await chatApi.open(managers[0]._id, v.project?._id);
      navigate(`/editor/chat?c=${data._id}&video=${v._id}`);
    } catch (err) { toast.error(err); }
    return undefined;
  };

  return (
    <>
      <Link to="/editor" className="mb-6 inline-block text-xs text-muted hover:text-cream">← My videos</Link>
      <div className="mb-8 flex flex-col gap-6 animate-fade-up lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2"><StatusBadge status={v.status} /><span className="text-xs text-muted">{v.project?.client?.company} · {v.project?.title}</span></div>
          <h1 className="text-4xl leading-tight sm:text-5xl text-balance">{v.title}</h1>
        </div>
        <div className={`card shrink-0 px-6 py-4 ${countdown?.overdue && active ? 'border-bad/40' : ''}`}>
          <div className="eyebrow text-[9px]">Your deadline · {fmtDateTime(v.editorDeadline)}</div>
          <div className={`mt-1 font-sans font-light tracking-tight text-4xl tabular-nums ${!active ? 'text-muted' : countdown?.overdue ? 'text-bad' : countdown?.urgent ? 'text-warn' : 'text-cream'}`}>
            {active ? countdown?.text : 'Submitted'}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {v.status === 'assigned' && (
            <Section title="Next step" className="border-cream/15">
              <p className="mb-4 text-sm text-muted">Download the footage, read the brief, then start work so the studio knows you’re on it.</p>
              <button className="btn-primary" onClick={start}>Start work</button>
            </Section>
          )}
          {v.status === 'changes_requested' && openNotes.length > 0 && (
            <Section title="Changes requested" className="border-warn/30">
              <FeedbackList items={openNotes.slice(-3)} />
            </Section>
          )}
          {canSubmit && <Section title="Submit a version" className="border-cream/15"><SubmitForm video={v} onDone={(d) => video.setData(d)} /></Section>}
          {['submitted', 'client_review', 'client_changes'].includes(v.status) && (
            <Section title="Status"><p className="text-sm text-muted">Your cut is with the studio. You’ll be notified when there are notes or it’s approved.</p></Section>
          )}
          <Section title="Brief & footage"><Brief video={v} /></Section>
          <Section title="Versions & feedback">
            <VersionList versions={v.versions} feedback={feedback.data || []} />
            <div className="mt-6"><FeedbackList items={feedback.data || []} emptyText="No notes from the studio yet." /></div>
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Questions?">
            <p className="mb-4 text-sm text-muted">Chat with the studio manager about this video.</p>
            <button className="btn-ghost w-full" onClick={messageManager}>Message manager</button>
          </Section>
          <Section title="History"><Timeline history={v.statusHistory} /></Section>
        </div>
      </div>
    </>
  );
}
