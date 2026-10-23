import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { videoApi, peopleApi, chatApi } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { useToast } from '../../context/ToastContext';
import { ErrorState, SkeletonList, StatusBadge, DeadlineFlag, Buffer, Modal, Field, Spinner } from '../../components/ui';
import { VideoFormModal } from '../../components/forms';
import { Section, Brief, VersionList, FeedbackList, Timeline, LinkTile, statusLabel } from '../../components/video/parts';
import { computeFlag } from '../../lib/status';
import { fmtDateTime, relDays, toLocalInput, fromLocalInput } from '../../lib/format';

const ACTIONS = {
  approved: { label: 'Approve', cls: 'btn-success', help: 'Approve this cut internally (skips client review).' },
  changes_requested: { label: 'Request changes', cls: 'btn-ghost', note: true, help: 'Send notes back to the editor.' },
  client_review: { label: 'Send to client', cls: 'btn-primary', help: 'The client will see the latest version and can approve or ask for changes.' },
  client_changes: { label: 'Record client changes', cls: 'btn-ghost', note: true, help: 'Log changes the client asked for outside the platform.' },
  delivered: { label: 'Mark delivered', cls: 'btn-primary', delivery: true, help: 'Share the final files with the client.' },
};
const DAY = 86400000;

function AssignPanel({ video, onSaved }) {
  const toast = useToast();
  const editors = useAsync(() => peopleApi.editors({ active: 'true' }), []);
  const [editorId, setEditorId] = useState(video.assignedEditor?._id || '');
  const [deadline, setDeadline] = useState(toLocalInput(video.editorDeadline));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setEditorId(video.assignedEditor?._id || ''); setDeadline(toLocalInput(video.editorDeadline)); }, [video]);

  const locked = ['approved', 'delivered'].includes(video.status);
  const buffer = deadline ? Math.round(((new Date(video.clientDeadline) - new Date(deadline)) / DAY) * 10) / 10 : null;
  const after = buffer !== null && buffer < 0;
  const changed = editorId !== (video.assignedEditor?._id || '') || deadline !== toLocalInput(video.editorDeadline);

  const save = async () => {
    if (!editorId || !deadline) return toast.error('Choose an editor and an editor deadline');
    setBusy(true);
    try {
      const res = await videoApi.assign(video._id, editorId, fromLocalInput(deadline));
      toast.success(video.assignedEditor ? 'Assignment updated' : 'Editor assigned');
      if (res.warning) toast.warn(res.warning);
      onSaved(res.data);
    } catch (err) { toast.error(err); } finally { setBusy(false); }
    return undefined;
  };

  return (
    <Section title={video.assignedEditor ? 'Assignment' : 'Assign an editor'}>
      <div className="space-y-4">
        <Field label="Editor" hint="Sorted by current workload">
          {(id) => (
            <select id={id} className="input" value={editorId} onChange={(e) => setEditorId(e.target.value)} disabled={locked}>
              <option value="">Choose an editor…</option>
              {(editors.data || []).map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name} — {e.activeCount} active{e.onTimePercent !== null ? ` · ${e.onTimePercent}% on time` : ''}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Editor deadline">
          {(id) => <input id={id} type="datetime-local" className={`input ${after ? 'border-bad/60 text-bad' : ''}`} value={deadline} onChange={(e) => setDeadline(e.target.value)} disabled={locked} />}
        </Field>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.06] bg-ink-950/40 p-3 text-xs">
          <div><div className="text-muted">Client deadline</div><div className="mt-0.5 text-cream-soft">{fmtDateTime(video.clientDeadline)}</div></div>
          <div className="text-right"><div className="text-muted">Buffer</div><div className="mt-0.5 text-base"><Buffer days={buffer} /></div></div>
        </div>
        {after && <p className="rounded-xl border border-bad/40 bg-bad/[0.07] px-3 py-2 text-xs text-bad">The editor deadline is after the client deadline. It will be saved, but this video will be flagged red.</p>}
        {!locked && (
          <button className="btn-primary w-full" disabled={busy || !changed} onClick={save}>
            {busy && <Spinner />}{video.assignedEditor ? 'Save assignment' : 'Assign editor'}
          </button>
        )}
      </div>
    </Section>
  );
}

function ActionModal({ action, video, onClose, onDone, prefill }) {
  const toast = useToast();
  const meta = ACTIONS[action];
  const [note, setNote] = useState(prefill || '');
  const [ts, setTs] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (meta.note && !note.trim()) return toast.error('Please describe the changes');
    if (meta.delivery && !/^https?:\/\/\S+\.\S+/.test(link)) return toast.error('Paste the full delivery link');
    if (ts && !/^(\d{1,2}:)?[0-5]?\d:[0-5]\d$/.test(ts)) return toast.error('Timestamp should look like 01:15');
    setBusy(true);
    try {
      const payload = { status: action };
      if (note.trim()) payload.note = note.trim();
      if (ts) payload.timestampInVideo = ts;
      if (link) payload.deliveryLink = link.trim();
      const res = await videoApi.setStatus(video._id, payload);
      toast.success(`Moved to ${statusLabel(action).toLowerCase()}`);
      onDone(res.data);
    } catch (err) { toast.error(err); } finally { setBusy(false); }
    return undefined;
  };
  return (
    <Modal open onClose={onClose} title={meta.label}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">{meta.help}</p>
        {meta.delivery && <Field label="Delivery link">{(id) => <input id={id} className="input" placeholder="https://drive.google.com/…" value={link} onChange={(e) => setLink(e.target.value)} />}</Field>}
        <Field label={meta.note ? 'Notes' : 'Note (optional)'}>{(id) => <textarea id={id} rows={4} className="input" value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        {meta.note && <Field label="Timestamp (optional)" hint="Where in the video, e.g. 00:42">{(id) => <input id={id} className="input font-mono" placeholder="00:42" value={ts} onChange={(e) => setTs(e.target.value)} />}</Field>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className={meta.cls} disabled={busy}>{busy && <Spinner />}{meta.label}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function ManagerVideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const video = useAsync(() => videoApi.get(id), [id]);
  const feedback = useAsync(() => videoApi.feedback(id), [id]);
  const [action, setAction] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useSocketEvent('video_updated', (p) => { if (p.videoId === id) { video.reload({ silent: true }); feedback.reload({ silent: true }); } });
  useSocketEvent('feedback_added', (p) => p.videoId === id && feedback.reload({ silent: true }));

  const v = video.data;
  const flag = useMemo(() => (v ? computeFlag(v) : null), [v]);
  if (video.error) return <ErrorState message={video.error} onRetry={video.reload} />;
  if (!v) return <SkeletonList rows={4} className="h-32" />;

  const latest = v.versions[v.versions.length - 1];
  const clientFeedback = (feedback.data || []).filter((f) => f.role === 'client' && !f.resolved);
  const prefill = action === 'changes_requested' && v.status === 'client_changes' && clientFeedback.length
    ? clientFeedback.map((f) => `${f.timestampInVideo ? `[${f.timestampInVideo}] ` : ''}${f.text}`).join('\n')
    : '';

  const updated = (data) => { video.setData(data); setAction(null); feedback.reload({ silent: true }); };
  const resolve = async (f) => {
    try { await videoApi.resolveFeedback(f._id, !f.resolved); feedback.reload({ silent: true }); } catch (err) { toast.error(err); }
  };
  const messageEditor = async () => {
    try {
      const { data } = await chatApi.open(v.assignedEditor._id);
      navigate(`/manager/chat?c=${data._id}&video=${v._id}`);
    } catch (err) { toast.error(err); }
  };
  const remove = async () => {
    try { await videoApi.remove(v._id); toast.success('Video deleted'); navigate(`/manager/projects/${v.project._id}`); } catch (err) { toast.error(err); }
  };

  return (
    <>
      <Link to={`/manager/projects/${v.project._id}`} className="mb-6 inline-block text-xs text-muted hover:text-cream">← {v.project.client?.company} · {v.project.title}</Link>
      <div className="mb-8 flex flex-col gap-4 animate-fade-up lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={v.status} />
            <DeadlineFlag flag={flag.flag} overdue={flag.overdue} />
            {latest && <span className="chip border-white/10 text-muted">v{latest.versionNumber}</span>}
          </div>
          <h1 className="text-4xl leading-tight sm:text-5xl text-balance">{v.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {v.assignedEditor && <button className="btn-ghost btn-sm" onClick={messageEditor}>Message {v.assignedEditor.name.split(' ')[0]}</button>}
          <button className="btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit details</button>
          <button className="btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>Delete</button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {(v.allowedNext.length > 0 || v.status === 'client_review') && (
            <Section title="Review" className="border-cream/15">
              {v.status === 'submitted' && latest && <div className="mb-4"><LinkTile label={`Version ${latest.versionNumber} from ${latest.submittedBy?.name || 'editor'}`} href={latest.link} /></div>}
              {v.status === 'client_review' && <p className="mb-4 text-sm text-muted">With the client for review. You can record their decision if they gave it outside the platform.</p>}
              {v.status === 'client_changes' && (
                <div className="mb-4 rounded-xl border border-warn/30 bg-warn/[0.05] p-4 text-sm">
                  <div className="mb-2 text-xs uppercase tracking-wider text-warn">The client asked for changes</div>
                  {clientFeedback.length ? clientFeedback.map((f) => <p key={f._id} className="text-cream-soft/90">{f.timestampInVideo && <span className="mr-2 font-mono text-cream">[{f.timestampInVideo}]</span>}{f.text}</p>) : <p className="text-muted">See feedback below.</p>}
                  <p className="mt-3 text-xs text-muted">Forward the notes to the editor — they never see client feedback directly.</p>
                </div>
              )}
              {['assigned', 'in_progress', 'changes_requested'].includes(v.status) && <p className="text-sm text-muted">Waiting on {v.assignedEditor?.name || 'the editor'} — due {relDays(v.editorDeadline)}.</p>}
              {v.status === 'footage_uploaded' && <p className="text-sm text-muted">Assign an editor to start the edit.</p>}
              <div className="flex flex-wrap gap-2">
                {v.allowedNext.filter((s) => s !== 'assigned').map((s) => (
                  <button key={s} className={`${ACTIONS[s]?.cls || 'btn-ghost'} btn-sm`} onClick={() => setAction(s)}>
                    {s === 'changes_requested' && v.status === 'client_changes' ? 'Forward to editor' : s === 'approved' && v.status === 'client_review' ? 'Record client approval' : ACTIONS[s]?.label || statusLabel(s)}
                  </button>
                ))}
              </div>
              {v.status === 'delivered' && v.deliveryLink && <LinkTile label="Delivered" href={v.deliveryLink} />}
            </Section>
          )}

          <Section title="Versions"><VersionList versions={v.versions} feedback={feedback.data || []} /></Section>
          <Section title="Feedback" action={<span className="text-[11px] text-muted">Client + manager notes</span>}>
            <FeedbackList items={feedback.data || []} onResolve={resolve} />
          </Section>
          <Section title="Brief & footage"><Brief video={v} /></Section>
          {v.internalNotes && <Section title="Internal notes"><p className="text-sm text-cream-soft/80">{v.internalNotes}</p></Section>}
        </div>

        <div className="space-y-6">
          <AssignPanel video={v} onSaved={(data) => video.setData(data)} />
          <Section title="Deadlines">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/[0.06] p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted">Editor</div>
                <div className="mt-1 text-sm">{v.editorDeadline ? fmtDateTime(v.editorDeadline) : '—'}</div>
                <div className="text-[11px] text-muted">{relDays(v.editorDeadline)}</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted">Client</div>
                <div className="mt-1 text-sm">{fmtDateTime(v.clientDeadline)}</div>
                <div className="text-[11px] text-muted">{relDays(v.clientDeadline)}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm"><span className="text-muted">Buffer</span><Buffer days={flag.bufferDays} /></div>
          </Section>
          <Section title="History"><Timeline history={v.statusHistory} /></Section>
        </div>
      </div>

      {action && <ActionModal action={action} video={v} prefill={prefill} onClose={() => setAction(null)} onDone={updated} />}
      {editing && <VideoFormModal open video={v} onClose={() => setEditing(false)} onSaved={(d) => video.setData(d)} />}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this video?">
        <p className="text-sm text-muted">This removes the video, its versions and feedback. It can’t be undone.</p>
        <div className="mt-8 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button><button className="btn-danger" onClick={remove}>Delete video</button></div>
      </Modal>
    </>
  );
}
