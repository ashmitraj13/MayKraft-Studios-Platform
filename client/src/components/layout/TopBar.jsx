import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { Avatar } from '../ui';
import { timeAgo } from '../../lib/format';

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    const fn = (e) => ref.current && !ref.current.contains(e.target) && onOutside();
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [ref, onOutside]);
}

export default function TopBar({ onMenu }) {
  const { user, logout } = useAuth();
  const { notifications, markNotificationsRead, clearNotifications, connected } = useRealtime();
  const [open, setOpen] = useState(null); // 'bell' | 'user' | null
  const ref = useRef(null);
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(null));
  const unread = notifications.filter((n) => !n.read).length;

  const go = (n) => {
    setOpen(null);
    if (n.kind === 'message') navigate(`/${user.role}/chat${n.conversationId ? `?c=${n.conversationId}` : ''}`);
    else if (n.videoId) navigate(`/${user.role}/videos/${n.videoId}`);
  };

  return (
    <header className="sticky top-0 z-[90] flex h-16 items-center gap-3 border-b border-white/[0.06] bg-ink-900/80 px-4 backdrop-blur-md sm:px-8" ref={ref}>
      <button className="-ml-1 rounded-lg p-2 text-cream lg:hidden" onClick={onMenu} aria-label="Open menu">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h14M3 10h14M3 14h9" /></svg>
      </button>
      <img src="/logo-wordmark.png" alt="MayKraft Studios" className="h-7 w-auto lg:hidden" />
      <div className="flex-1" />
      <span title={connected ? 'Live updates on' : 'Reconnecting…'} className={`hidden items-center gap-2 text-[11px] text-muted sm:flex`}>
        <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-ok' : 'bg-warn animate-pulse'}`} />
        {connected ? 'Live' : 'Offline'}
      </span>

      <div className="relative">
        <button
          className="relative rounded-full p-2 text-cream-soft transition hover:bg-white/5"
          onClick={() => { setOpen(open === 'bell' ? null : 'bell'); markNotificationsRead(); }}
          aria-label="Notifications"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 004 0" /></svg>
          {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[9px] font-bold text-white">{unread}</span>}
        </button>
        {open === 'bell' && (
          <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-ink-800 shadow-glow animate-fade-up">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="eyebrow">Notifications</span>
              {notifications.length > 0 && <button className="text-xs text-muted hover:text-cream" onClick={clearNotifications}>Clear</button>}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 && <p className="px-4 pb-6 pt-2 text-sm text-muted">You’re all caught up.</p>}
              {notifications.map((n) => (
                <button key={n.id} onClick={() => go(n)} className="block w-full border-t border-white/[0.05] px-4 py-3 text-left transition hover:bg-white/[0.03]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-cream-soft">{n.title}</span>
                    <span className="shrink-0 text-[10px] text-muted">{timeAgo(n.at)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">{n.body}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button className="flex items-center gap-3 rounded-full py-1 pl-1 pr-1 transition hover:bg-white/5 sm:pr-3" onClick={() => setOpen(open === 'user' ? null : 'user')}>
          <Avatar name={user?.name} size="sm" />
          <span className="hidden text-left sm:block">
            <span className="block text-sm leading-tight text-cream-soft">{user?.name}</span>
            <span className="block text-[10px] uppercase tracking-wider text-muted">{user?.company || user?.role}</span>
          </span>
        </button>
        {open === 'user' && (
          <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-ink-800 py-2 shadow-glow animate-fade-up">
            <div className="px-4 py-2 text-xs text-muted break-all">{user?.email}</div>
            <button className="w-full px-4 py-2.5 text-left text-sm text-cream-soft hover:bg-white/5" onClick={() => { logout(); navigate('/'); }}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
