import { useState } from 'react';
import { Modal, Field, Spinner } from '../ui';
import { authApi, projectApi, videoApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { toLocalInput, fromLocalInput } from '../../lib/format';

const isUrl = (s) => /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(s.trim());

function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const bind = (k) => ({ value: values[k] ?? '', onChange: (e) => setValues((v) => ({ ...v, [k]: e.target.value })) });
  return { values, setValues, errors, setErrors, busy, setBusy, bind };
}

function Actions({ busy, onClose, label }) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn-primary" disabled={busy}>{busy && <Spinner />}{label}</button>
    </div>
  );
}

/** Create an editor or client account (manager). */
export function UserFormModal({ open, onClose, role, onCreated }) {
  const toast = useToast();
  const f = useForm({ name: '', email: '', password: '', company: '', skills: '' });
  const submit = async (e) => {
    e.preventDefault();
    const { name, email, password, company, skills } = f.values;
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Enter a valid email';
    if (password.length < 8) errs.password = 'At least 8 characters';
    if (role === 'client' && !company.trim()) errs.company = 'Company is required';
    f.setErrors(errs);
    if (Object.keys(errs).length) return;
    f.setBusy(true);
    try {
      const payload = { name: name.trim(), email: email.trim(), password, role };
      if (role === 'client') payload.company = company.trim();
      if (role === 'editor' && skills.trim()) payload.skills = skills.split(',').map((s) => s.trim()).filter(Boolean);
      const { data } = await authApi.register(payload);
      toast.success(`${role === 'client' ? 'Client' : 'Editor'} account created for ${data.name}`);
      f.setValues({ name: '', email: '', password: '', company: '', skills: '' });
      onCreated?.(data);
      onClose();
    } catch (err) {
      if (err.response?.status === 409) f.setErrors({ email: err.userMessage });
      else toast.error(err);
    } finally {
      f.setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={role === 'client' ? 'New client' : 'New editor'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {role === 'client' && <Field label="Company / brand" error={f.errors.company}>{(id) => <input id={id} className="input" placeholder="Chaiwala Junction" {...f.bind('company')} />}</Field>}
        <Field label={role === 'client' ? 'Contact name' : 'Name'} error={f.errors.name}>{(id) => <input id={id} className="input" {...f.bind('name')} />}</Field>
        <Field label="Email" error={f.errors.email}>{(id) => <input id={id} type="email" className="input" {...f.bind('email')} />}</Field>
        <Field label="Temporary password" error={f.errors.password} hint="Share this with them securely.">{(id) => <input id={id} className="input" {...f.bind('password')} />}</Field>
        {role === 'editor' && <Field label="Skills" hint="Comma separated, e.g. Colour grading, After Effects">{(id) => <input id={id} className="input" {...f.bind('skills')} />}</Field>}
        <Actions busy={f.busy} onClose={onClose} label="Create account" />
      </form>
    </Modal>
  );
}

/** Create or edit a project. */
export function ProjectFormModal({ open, onClose, clients = [], project, defaultClient, onSaved }) {
  const toast = useToast();
  const f = useForm({
    title: project?.title || '',
    client: project?.client?._id || project?.client || defaultClient || '',
    description: project?.description || '',
    totalVideos: project?.totalVideos || 4,
    clientDeadline: toLocalInput(project?.clientDeadline) || '',
    status: project?.status || 'active',
  });
  const submit = async (e) => {
    e.preventDefault();
    const v = f.values;
    const errs = {};
    if (!v.title.trim()) errs.title = 'Title is required';
    if (!v.client) errs.client = 'Choose a client';
    if (!(Number(v.totalVideos) >= 1)) errs.totalVideos = 'At least 1 video';
    if (!v.clientDeadline) errs.clientDeadline = 'Pick the client deadline';
    f.setErrors(errs);
    if (Object.keys(errs).length) return;
    f.setBusy(true);
    try {
      const payload = { title: v.title.trim(), client: v.client, description: v.description, totalVideos: Number(v.totalVideos), clientDeadline: fromLocalInput(v.clientDeadline), status: v.status };
      const res = project ? await projectApi.update(project._id, payload) : await projectApi.create(payload);
      toast.success(project ? 'Project updated' : 'Project created');
      if (res.warning) toast.warn(res.warning);
      onSaved?.(res.data);
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      f.setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={project ? 'Edit project' : 'New project'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Title" error={f.errors.title}>{(id) => <input id={id} className="input" placeholder="Monsoon Menu Launch" {...f.bind('title')} />}</Field>
        <Field label="Client" error={f.errors.client}>
          {(id) => (
            <select id={id} className="input" {...f.bind('client')}>
              <option value="">Choose a client…</option>
              {clients.map((c) => <option key={c._id} value={c._id}>{c.company} — {c.name}</option>)}
            </select>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Total videos" error={f.errors.totalVideos}>{(id) => <input id={id} type="number" min="1" className="input" {...f.bind('totalVideos')} />}</Field>
          <Field label="Client deadline" error={f.errors.clientDeadline}>{(id) => <input id={id} type="datetime-local" className="input" {...f.bind('clientDeadline')} />}</Field>
        </div>
        {project && (
          <Field label="Status">{(id) => (
            <select id={id} className="input" {...f.bind('status')}>
              <option value="active">Active</option><option value="on-hold">On hold</option><option value="completed">Completed</option>
            </select>
          )}</Field>
        )}
        <Field label="Description">{(id) => <textarea id={id} rows={3} className="input" {...f.bind('description')} />}</Field>
        <Actions busy={f.busy} onClose={onClose} label={project ? 'Save changes' : 'Create project'} />
      </form>
    </Modal>
  );
}

/** Add a video to a project, or edit its details. */
export function VideoFormModal({ open, onClose, projectId, video, onSaved }) {
  const toast = useToast();
  const f = useForm({
    title: video?.title || '',
    footageLink: video?.footageLink || '',
    brief: video?.brief || '',
    referenceLinks: (video?.referenceLinks || []).join('\n'),
    clientDeadline: toLocalInput(video?.clientDeadline) || '',
    internalNotes: video?.internalNotes || '',
  });
  const submit = async (e) => {
    e.preventDefault();
    const v = f.values;
    const refs = v.referenceLinks.split(/\s+/).map((s) => s.trim()).filter(Boolean);
    const errs = {};
    if (!v.title.trim()) errs.title = 'Title is required';
    if (!isUrl(v.footageLink)) errs.footageLink = 'Paste a full link (https://…) to Drive, Frame.io, Dropbox…';
    if (refs.some((r) => !isUrl(r))) errs.referenceLinks = 'Every reference must be a full https:// link';
    f.setErrors(errs);
    if (Object.keys(errs).length) return;
    f.setBusy(true);
    try {
      const payload = { title: v.title.trim(), footageLink: v.footageLink.trim(), brief: v.brief, referenceLinks: refs, internalNotes: v.internalNotes };
      if (v.clientDeadline) payload.clientDeadline = fromLocalInput(v.clientDeadline);
      const res = video ? await videoApi.update(video._id, payload) : await projectApi.addVideo(projectId, payload);
      toast.success(video ? 'Video updated' : 'Video added');
      if (res.warning) toast.warn(res.warning);
      onSaved?.(res.data);
      onClose();
    } catch (err) {
      toast.error(err);
    } finally {
      f.setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={video ? 'Edit video' : 'Add a video'} wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Title" error={f.errors.title}>{(id) => <input id={id} className="input" placeholder="Masala Chai Pour — 15s Reel" {...f.bind('title')} />}</Field>
        <Field label="Footage link" error={f.errors.footageLink} hint="Google Drive, Frame.io, Dropbox or any shareable link">{(id) => <input id={id} className="input" placeholder="https://drive.google.com/…" {...f.bind('footageLink')} />}</Field>
        <Field label="Brief">{(id) => <textarea id={id} rows={4} className="input" placeholder="Format, length, hook, music, CTA…" {...f.bind('brief')} />}</Field>
        <Field label="Reference links" error={f.errors.referenceLinks} hint="One per line">{(id) => <textarea id={id} rows={3} className="input font-mono text-xs" {...f.bind('referenceLinks')} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client deadline" hint="Defaults to the project deadline">{(id) => <input id={id} type="datetime-local" className="input" {...f.bind('clientDeadline')} />}</Field>
          <Field label="Internal notes" hint="Never shown to the client or editor">{(id) => <input id={id} className="input" {...f.bind('internalNotes')} />}</Field>
        </div>
        <Actions busy={f.busy} onClose={onClose} label={video ? 'Save changes' : 'Add video'} />
      </form>
    </Modal>
  );
}

/** Any user: replace the temporary password the studio gave them. */
export function PasswordModal({ open, onClose }) {
  const toast = useToast();
  const f = useForm({ current: '', next: '', confirm: '' });
  const close = () => { f.setValues({ current: '', next: '', confirm: '' }); f.setErrors({}); onClose(); };
  const submit = async (e) => {
    e.preventDefault();
    const { current, next, confirm } = f.values;
    const errs = {};
    if (!current) errs.current = 'Enter your current password';
    if (next.length < 8) errs.next = 'At least 8 characters';
    else if (next === current) errs.next = 'Choose a different password';
    if (confirm !== next) errs.confirm = 'Passwords do not match';
    f.setErrors(errs);
    if (Object.keys(errs).length) return;
    f.setBusy(true);
    try {
      await authApi.changePassword(current, next);
      toast.success('Password updated');
      close();
    } catch (err) {
      if (err.response?.status === 400 && /current/i.test(err.userMessage)) f.setErrors({ current: err.userMessage });
      else toast.error(err);
    } finally {
      f.setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={close} title="Change password">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Current password" error={f.errors.current}>{(id) => <input id={id} type="password" autoComplete="current-password" className="input" {...f.bind('current')} />}</Field>
        <Field label="New password" error={f.errors.next}>{(id) => <input id={id} type="password" autoComplete="new-password" className="input" {...f.bind('next')} />}</Field>
        <Field label="Confirm new password" error={f.errors.confirm}>{(id) => <input id={id} type="password" autoComplete="new-password" className="input" {...f.bind('confirm')} />}</Field>
        <Actions busy={f.busy} onClose={close} label="Update password" />
      </form>
    </Modal>
  );
}
