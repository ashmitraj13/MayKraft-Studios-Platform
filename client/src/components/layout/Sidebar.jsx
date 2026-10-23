import { NavLink } from 'react-router-dom';
import { useRealtime } from '../../context/RealtimeContext';

const NAV = {
  manager: [
    { to: '/manager', label: 'Dashboard', end: true, icon: '◐' },
    { to: '/manager/clients', label: 'Clients', icon: '◇' },
    { to: '/manager/editors', label: 'Editors', icon: '✦' },
    { to: '/manager/chat', label: 'Messages', icon: '◌', chat: true },
  ],
  editor: [
    { to: '/editor', label: 'My videos', end: true, icon: '▶' },
    { to: '/editor/chat', label: 'Messages', icon: '◌', chat: true },
  ],
  client: [
    { to: '/client', label: 'My projects', end: true, icon: '◇' },
    { to: '/client/chat', label: 'Messages', icon: '◌', chat: true },
  ],
};

export default function Sidebar({ role, open, onClose }) {
  const { unreadTotal } = useRealtime();
  const items = NAV[role] || [];

  const content = (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-8 pt-7">
        <img src="/logo-wordmark.png" alt="MayKraft Studios" className="h-10 w-auto" />
        <div className="eyebrow mt-4 text-[10px]">{role} workspace</div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            onClick={onClose}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition ${
                isActive ? 'bg-cream/[0.08] text-cream' : 'text-muted hover:bg-white/[0.03] hover:text-cream-soft'
              }`
            }
          >
            <span className="w-4 text-center text-xs opacity-70">{it.icon}</span>
            <span className="flex-1">{it.label}</span>
            {it.chat && unreadTotal > 0 && (
              <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-ink-900">{unreadTotal}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-6 py-6 text-[10px] uppercase tracking-[0.3em] text-muted/60">Purpose · Virality · Quality</div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-white/[0.06] bg-ink-950/40 lg:block">{content}</aside>
      {open && (
        <div className="fixed inset-0 z-[120] lg:hidden">
          <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={onClose} />
          <aside className="relative h-full w-72 max-w-[85vw] border-r border-white/10 bg-ink-900 animate-slide-in">{content}</aside>
        </div>
      )}
    </>
  );
}
