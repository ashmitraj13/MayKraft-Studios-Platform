import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { chatApi, peopleApi, videoApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { emitAck } from '../../socket/socket';
import { Avatar, EmptyState, Modal, Skeleton, Spinner } from '../ui';
import { fmtTime, fmtShort, timeAgo } from '../../lib/format';

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

function ConversationList({ conversations, activeId, onSelect, online, onNew, loading }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-2xl">Messages</h2>
        <button className="btn-ghost btn-sm" onClick={onNew}>New</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="space-y-2 px-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>}
        {!loading && conversations.length === 0 && <p className="px-5 py-6 text-sm text-muted">No conversations yet. Start one with “New”.</p>}
        {conversations.map((c) => {
          const other = c.otherUser || {};
          return (
            <button
              key={c._id}
              onClick={() => onSelect(c._id)}
              className={`flex w-full items-center gap-3 border-l-2 px-5 py-3.5 text-left transition ${activeId === c._id ? 'border-cream bg-cream/[0.05]' : 'border-transparent hover:bg-white/[0.02]'}`}
            >
              <Avatar name={other.company || other.name} online={online.has(other._id)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${c.unreadCount ? 'font-semibold text-cream' : 'text-cream-soft'}`}>{other.name}</span>
                  <span className="shrink-0 text-[10px] text-muted">{c.lastMessage ? timeAgo(c.lastMessage.createdAt) : ''}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted">{other.company || other.role}{c.lastMessage ? ` · ${c.lastMessage.text}` : ''}</span>
                  {c.unreadCount > 0 && <span className="shrink-0 rounded-full bg-cream px-1.5 py-0.5 text-[10px] font-bold text-ink-900">{c.unreadCount}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VideoChip({ video, role }) {
  if (!video) return null;
  return (
    <Link to={`/${role}/videos/${video._id}`} className="mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-current/30 bg-black/10 px-2.5 py-0.5 text-[11px] opacity-90 hover:opacity-100">
      <span>▶</span><span className="truncate">Feedback on {video.title}</span>
    </Link>
  );
}

function Thread({ conversation, onBack }) {
  const { user } = useAuth();
  const toast = useToast();
  const { socket, connected, setConversations, setActiveConversation } = useRealtime();
  const [params, setParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(null);
  const [videos, setVideos] = useState([]);
  const [attached, setAttached] = useState(params.get('video') || '');
  const scroller = useRef(null);
  const stickToBottom = useRef(true);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);
  const other = conversation.otherUser || {};
  const id = conversation._id;

  const markRead = useCallback(() => {
    setConversations((list) => list.map((c) => (c._id === id ? { ...c, unreadCount: 0 } : c)));
    if (socket?.connected) socket.emit('mark_read', { conversationId: id });
    else chatApi.read(id).catch(() => {});
  }, [id, socket, setConversations]);

  useEffect(() => {
    setActiveConversation(id);
    return () => setActiveConversation(null);
  }, [id, setActiveConversation]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMessages([]);
    stickToBottom.current = true;
    chatApi.messages(id, { limit: 30 }).then((res) => {
      if (!alive) return;
      setMessages(res.data);
      setHasMore(res.hasMore);
      setLoading(false);
      markRead();
    }).catch((err) => { toast.error(err); setLoading(false); });
    if (socket?.connected) socket.emit('join_conversation', { conversationId: id });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // videos that can be referenced in this conversation
  useEffect(() => {
    videoApi.list().then(({ data }) => {
      let list = data;
      if (user.role === 'manager' && other.role === 'editor') list = data.filter((v) => v.assignedEditor?._id === other._id);
      if (user.role === 'manager' && other.role === 'client') list = data.filter((v) => v.project?.client?._id === other._id && ['client_review', 'approved', 'delivered'].includes(v.status));
      setVideos(list);
    }).catch(() => {});
  }, [user.role, other._id, other.role]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  useSocketEvent('new_message', ({ conversationId, message }) => {
    if (conversationId !== id) return;
    setMessages((list) => (list.some((m) => m._id === message._id) ? list : [...list, message]));
    if (String(message.sender?._id) !== String(user._id)) {
      setTyping(null);
      if (document.visibilityState === 'visible') markRead();
    }
  });
  useSocketEvent('typing', (p) => {
    if (p.conversationId !== id || p.userId === user._id) return;
    setTyping(p.isTyping ? p.name : null);
    clearTimeout(typingTimer.current);
    if (p.isTyping) typingTimer.current = setTimeout(() => setTyping(null), 4000);
  });
  useSocketEvent('messages_read', (p) => {
    if (p.conversationId !== id) return;
    setMessages((list) => list.map((m) => (m.readBy?.includes(p.userId) ? m : { ...m, readBy: [...(m.readBy || []), p.userId] })));
  });

  const loadEarlier = async () => {
    if (!messages.length) return;
    setLoadingMore(true);
    const el = scroller.current;
    const prevHeight = el?.scrollHeight || 0;
    try {
      const res = await chatApi.messages(id, { before: messages[0]._id, limit: 30 });
      stickToBottom.current = false;
      setMessages((list) => [...res.data, ...list]);
      setHasMore(res.hasMore);
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
    } catch (err) { toast.error(err); } finally { setLoadingMore(false); }
  };

  const onType = (e) => {
    setText(e.target.value);
    const now = Date.now();
    if (socket?.connected && now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      socket.emit('typing', { conversationId: id, isTyping: true });
    }
  };

  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    stickToBottom.current = true;
    const payload = { conversationId: id, text: body, video: attached || undefined };
    try {
      let saved;
      if (connected) saved = (await emitAck(socket, 'send_message', payload)).data;
      else saved = (await chatApi.send(id, { text: body, video: attached || undefined })).data;
      setMessages((list) => (list.some((m) => m._id === saved._id) ? list : [...list, saved]));
      setText('');
      if (attached) { setAttached(''); params.delete('video'); setParams(params, { replace: true }); }
      socket?.emit('typing', { conversationId: id, isTyping: false });
      lastTypingSent.current = 0;
    } catch (err) {
      toast.error(err.userMessage || err.message);
    } finally {
      setSending(false);
    }
  };

  const onScroll = () => {
    const el = scroller.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const lastMineSeen = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (String(m.sender?._id) === String(user._id)) return m.readBy?.includes(other._id) ? m._id : null;
    }
    return null;
  }, [messages, user._id, other._id]);

  const attachedVideo = videos.find((v) => v._id === attached);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6">
        <button className="-ml-1 rounded-lg p-1.5 text-cream lg:hidden" onClick={onBack} aria-label="Back to conversations">←</button>
        <Avatar name={other.company || other.name} />
        <div className="min-w-0">
          <div className="truncate text-sm text-cream-soft">{other.name}</div>
          <div className="truncate text-[11px] uppercase tracking-wider text-muted">{other.company || other.role}</div>
        </div>
      </div>

      <div ref={scroller} onScroll={onScroll} className="flex-1 space-y-1 overflow-y-auto px-4 py-5 sm:px-6">
        {loading && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className={`h-12 ${i % 2 ? 'ml-auto w-2/3' : 'w-1/2'}`} />)}</div>}
        {hasMore && !loading && (
          <div className="pb-3 text-center"><button className="btn-ghost btn-sm" onClick={loadEarlier} disabled={loadingMore}>{loadingMore && <Spinner className="h-3 w-3" />}Load earlier</button></div>
        )}
        {!loading && messages.length === 0 && <p className="py-10 text-center text-sm text-muted">Say hello to {other.name?.split(' ')[0]} 👋</p>}
        {messages.map((m, i) => {
          const mine = String(m.sender?._id) === String(user._id);
          const showDay = i === 0 || !sameDay(messages[i - 1].createdAt, m.createdAt);
          const grouped = i > 0 && !showDay && messages[i - 1].sender?._id === m.sender?._id;
          return (
            <div key={m._id}>
              {showDay && <div className="py-3 text-center text-[10px] uppercase tracking-[0.25em] text-muted">{fmtShort(m.createdAt)}</div>}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-0.5' : 'mt-3'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm sm:max-w-[70%] ${mine ? 'rounded-br-md bg-cream text-ink-900' : 'rounded-bl-md border border-white/[0.07] bg-ink-700 text-cream-soft'}`}>
                  <VideoChip video={m.video} role={user.role} />
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <div className={`mt-1 text-right text-[10px] ${mine ? 'text-ink-900/60' : 'text-muted'}`}>
                    {fmtTime(m.createdAt)}{mine && lastMineSeen === m._id ? ' · Seen' : ''}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {typing && <div className="mt-3 text-xs italic text-muted">{typing} is typing…</div>}
      </div>

      <form onSubmit={send} className="border-t border-white/[0.06] p-3 sm:p-4">
        {attachedVideo && (
          <div className="mb-2 flex items-center gap-2">
            <span className="chip border-cream/30 text-cream">▶ Feedback on {attachedVideo.title}</span>
            <button type="button" className="text-xs text-muted hover:text-cream" onClick={() => setAttached('')}>Remove</button>
          </div>
        )}
        <div className="flex items-end gap-2">
          {videos.length > 0 && (
            <select className="input hidden w-40 shrink-0 sm:block" value={attached} onChange={(e) => setAttached(e.target.value)} aria-label="Attach a video">
              <option value="">Attach video…</option>
              {videos.map((v) => <option key={v._id} value={v._id}>{v.title}</option>)}
            </select>
          )}
          <textarea
            rows={1}
            className="input max-h-40 min-h-[44px] flex-1 resize-none"
            placeholder={`Message ${other.name?.split(' ')[0] || ''}…`}
            value={text}
            onChange={onType}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            aria-label="Message"
          />
          <button className="btn-primary h-[44px] shrink-0 px-5" disabled={!text.trim() || sending}>{sending ? <Spinner /> : 'Send'}</button>
        </div>
        {videos.length > 0 && (
          <select className="input mt-2 sm:hidden" value={attached} onChange={(e) => setAttached(e.target.value)} aria-label="Attach a video">
            <option value="">Attach a video (optional)…</option>
            {videos.map((v) => <option key={v._id} value={v._id}>{v.title}</option>)}
          </select>
        )}
      </form>
    </div>
  );
}

function NewConversationModal({ open, onClose, onPick }) {
  const { user } = useAuth();
  const [people, setPeople] = useState(null);
  useEffect(() => {
    if (!open) return;
    setPeople(null);
    if (user.role === 'manager') {
      Promise.all([peopleApi.editors({ active: 'true' }), peopleApi.clients()]).then(([e, c]) =>
        setPeople([...e.data.map((x) => ({ ...x, role: 'editor' })), ...c.data.filter((x) => x.isActive).map((x) => ({ ...x, role: 'client' }))])
      ).catch(() => setPeople([]));
    } else {
      peopleApi.managers().then(({ data }) => setPeople(data)).catch(() => setPeople([]));
    }
  }, [open, user.role]);
  return (
    <Modal open={open} onClose={onClose} title="New conversation">
      {!people && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>}
      {people?.length === 0 && <p className="text-sm text-muted">No one available to message.</p>}
      <div className="space-y-1">
        {(people || []).map((p) => (
          <button key={p._id} onClick={() => onPick(p)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.04]">
            <Avatar name={p.company || p.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-cream-soft">{p.name}</span>
              <span className="block truncate text-[11px] uppercase tracking-wider text-muted">{p.company || p.role}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export default function ChatPanel() {
  const { conversations, refreshConversations, online } = useRealtime();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [picking, setPicking] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const activeId = params.get('c');

  useEffect(() => { refreshConversations().finally(() => setLoaded(true)); }, [refreshConversations]);

  const select = (cid) => { const next = new URLSearchParams(); next.set('c', cid); setParams(next); };
  const back = () => setParams(new URLSearchParams());
  const active = conversations.find((c) => c._id === activeId);

  const pick = async (person) => {
    try {
      const { data } = await chatApi.open(person._id);
      setPicking(false);
      await refreshConversations();
      select(data._id);
    } catch (err) { toast.error(err); }
  };

  return (
    <div className="card -mx-4 flex h-[calc(100dvh-8rem)] min-h-[480px] overflow-hidden rounded-none border-x-0 sm:mx-0 sm:h-[calc(100dvh-10rem)] sm:rounded-2xl sm:border-x">
      <div className={`w-full shrink-0 border-r border-white/[0.06] lg:block lg:w-80 ${active ? 'hidden' : 'block'}`}>
        <ConversationList conversations={conversations} activeId={activeId} onSelect={select} online={online} onNew={() => setPicking(true)} loading={!loaded && conversations.length === 0} />
      </div>
      <div className={`min-w-0 flex-1 ${active ? 'flex' : 'hidden lg:flex'} flex-col`}>
        {active ? (
          <Thread key={active._id} conversation={active} onBack={back} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState title="Pick a conversation" body="Messages are saved, so nothing is lost on refresh. Attach a video to point at a specific film." icon="◌" />
          </div>
        )}
      </div>
      <NewConversationModal open={picking} onClose={() => setPicking(false)} onPick={pick} />
    </div>
  );
}
