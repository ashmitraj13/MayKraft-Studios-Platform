import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind, text, ms = 4500) => {
      const id = nextId++;
      setToasts((t) => [...t.slice(-3), { id, kind, text }]);
      setTimeout(() => dismiss(id), ms);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (t) => push('success', t),
      error: (t) => push('error', typeof t === 'string' ? t : t?.userMessage || 'Something went wrong', 6000),
      warn: (t) => push('warn', t, 7000),
      info: (t) => push('info', t),
    }),
    [push]
  );

  const tone = {
    success: 'border-ok/40 text-ok',
    error: 'border-bad/50 text-bad',
    warn: 'border-warn/50 text-warn',
    info: 'border-cream/30 text-cream',
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[200] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-xl border bg-ink-800/95 px-4 py-3 text-sm shadow-glow backdrop-blur ${tone[t.kind]}`}
          >
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
            <span className="flex-1 text-cream-soft">{t.text}</span>
            <button onClick={() => dismiss(t.id)} className="text-muted hover:text-cream" aria-label="Dismiss">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
