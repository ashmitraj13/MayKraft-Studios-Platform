import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { videoApi, peopleApi, chatApi } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { useToast } from '../../context/ToastContext';
import { ErrorState, SkeletonList, StatusBadge, Field, Spinner, Modal } from '../../components/ui';
import { Section, FeedbackList, Player, LinkTile } from '../../components/video/parts';
import { fmtDateTime } from '../../lib/format';

export default function VideoReview() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const video = useAsync(() => videoApi.get(id), [id]);
  const feedback = useAsync(() => videoApi.feedback(id), [id]);
  const [text, setText] = useState('');
  const [ts, setTs] = useState('');
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(false);
  useSocketEvent('video_updated', (p) => p.videoId === id && video.reload({ silent: true }));

  const v = video.data;
  if (video.error) return <ErrorState message={video.error} onRetry={video.reload} />;
  if (!v) return <SkeletonList rows={3} className="h-40" />;
  const reviewing = v.status === 'client_review';

  const validTs = !ts || /^(\d{1,2}:)?[0-5]?\d:[0-5]\d$/.test(ts);
  const decide = async (status) => {
    if (status === 'client_changes' && !text.trim()) return toast.error('Tell us what you’d like changed');
    if (!validTs) return toast.error('Timestamp should look like 01:15');
    setBusy(status);
    try {
      const payload = { status };
      if (text.trim()) payload.note = text.trim();
      if (ts) payload.timestampInVideo = ts;
      const res = await videoApi.setStatus(v._id, payload);
      video.setData(res.data);
      feedback.reload({ silent: true });
      setText(''); setTs(''); setConfirm(false);
      toast.success(status === 'approved' ? 'Approved — thank you!' : 'Your feedback is with the studio');
    } catch (err) { toast.error(err); } finally { setBusy(null); }
    return undefined;
  };
  const addNote = async () => {
    if (!text.trim()) return;
    if (!validTs) return toast.error('Timestamp should look like 01:15');
    setBusy('note');
    try {
      await videoApi.addFeedback(v._id, { text: text.trim(), timestampInVideo: ts || undefined });
      setText(''); setTs('');
      feedback.reload({ silent: true });
      toast.success('Note added');
    } catch (err) { toast.error(err); } finally { setBusy(null); }
    return undefined;
  };
  const message = async () => {
    try {
      const { data: managers } = await peopleApi.managers();
      const { data } = await chatApi.open(managers[0]._id, v.project?._id);
      navigate(`/client/chat?c=${data._id}&video=${v._id}`);
    } catch (err) { toast.error(err); }
  };

  return (
    <>
      <Link to={`/client/projects/${v.project._id}`} className="mb-6 inline-block text-xs text-muted hover:text-cream">← {v.project.title}</Link>
      <div className="mb-8 animate-fade-up">
        <div className="mb-3 flex flex-wrap items-center gap-2"><StatusBadge status={v.status} client />{v.currentVersion && <span className="chip border-white/10 text-muted">Version {v.currentVersion}</span>}</div>
        <h1 className="text-4xl leading-tight sm:text-5xl text-balance">{v.title}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {v.status === 'delivered' ? (
            <Section title="Final delivery" className="border-ok/30">
              <p className="mb-4 text-sm text-muted">Your film is delivered. Download the final files below.</p>
              {v.deliveryLink && <LinkTile label="Final files" href={v.deliveryLink} />}
              {v.reviewLink && <div className="mt-4"><Player link={v.reviewLink} title={v.title} /></div>}
            </Section>
          ) : (
            <>
              <Player link={v.reviewLink} title={v.title} />
              {v.reviewLink && <LinkTile label="Open the review link" href={v.reviewLink} />}
            </>
          )}
          {v.brief && <Section title="Brief"><p className="whitespace-pre-line text-sm leading-relaxed text-cream-soft/85">{v.brief}</p></Section>}
          <Section title="Your feedback"><FeedbackList items={feedback.data || []} emptyText="You haven’t left any notes on this film." /></Section>
        </div>

        <div className="space-y-6">
          <Section title={reviewing ? 'Your review' : 'Add a note'} className={reviewing ? 'border-cream/20' : ''}>
            {reviewing && <p className="mb-4 text-sm text-muted">Happy with it? Approve. Want tweaks? Describe them — add a timestamp to point at a moment.</p>}
            {v.status === 'approved' && <p className="mb-4 text-sm text-ok">You approved this film. We’re preparing the final delivery.</p>}
            <div className="space-y-3">
              <Field label="Feedback">{(fid) => <textarea id={fid} rows={4} className="input" placeholder="e.g. Can the logo be a little bigger in the end card?" value={text} onChange={(e) => setText(e.target.value)} />}</Field>
              <Field label="Timestamp (optional)" error={!validTs ? 'Use mm:ss, e.g. 01:15' : null}>{(fid) => <input id={fid} className="input font-mono" placeholder="01:15" value={ts} onChange={(e) => setTs(e.target.value)} />}</Field>
            </div>
            {reviewing ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <button className="btn-ghost" disabled={!!busy} onClick={() => decide('client_changes')}>{busy === 'client_changes' && <Spinner />}Request changes</button>
                <button className="btn-success" disabled={!!busy} onClick={() => setConfirm(true)}>Approve</button>
              </div>
            ) : (
              <button className="btn-ghost mt-5 w-full" disabled={!text.trim() || !!busy} onClick={addNote}>{busy === 'note' && <Spinner />}Send note</button>
            )}
            <p className="mt-4 text-[11px] text-muted">Feedback goes to your MayKraft producer, who briefs the edit team.</p>
          </Section>
          <Section title="Talk to us">
            <button className="btn-ghost w-full" onClick={message}>Message your producer</button>
          </Section>
          {v.statusHistory?.length > 0 && (
            <Section title="Timeline">
              <ul className="space-y-2 text-xs">{[...v.statusHistory].reverse().map((h, i) => <li key={i} className="flex justify-between gap-2"><StatusBadge status={h.status} client /><span className="text-muted">{fmtDateTime(h.at)}</span></li>)}</ul>
            </Section>
          )}
        </div>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Approve this film?">
        <p className="text-sm text-muted">We’ll prepare the final files for delivery.{text.trim() ? ' Your note will be sent with the approval.' : ''}</p>
        <div className="mt-8 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setConfirm(false)}>Not yet</button>
          <button className="btn-success" disabled={!!busy} onClick={() => decide('approved')}>{busy === 'approved' && <Spinner />}Approve</button>
        </div>
      </Modal>
    </>
  );
}
