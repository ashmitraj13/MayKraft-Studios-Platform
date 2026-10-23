import { useCallback, useEffect, useRef, useState } from 'react';

/** Runs an async loader, tracks loading/error, and exposes reload(). */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null, meta: null });
  const alive = useRef(true);
  const seq = useRef(0);

  const run = useCallback(async ({ silent = false } = {}) => {
    const my = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await loader();
      if (alive.current && my === seq.current) setState({ loading: false, error: null, data: res?.data ?? res, meta: res });
    } catch (err) {
      if (alive.current && my === seq.current) setState((s) => ({ ...s, loading: false, error: err.userMessage || 'Failed to load' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    alive.current = true;
    run();
    return () => { alive.current = false; };
  }, [run]);

  return { ...state, reload: run, setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) };
}
