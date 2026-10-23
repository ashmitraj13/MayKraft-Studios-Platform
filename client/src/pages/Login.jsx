import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_META } from '../lib/roles';
import { Spinner } from '../components/ui';

const SHOW_DEMO = import.meta.env.VITE_SHOW_DEMO !== 'false';

export default function Login() {
  const { role } = useParams();
  const meta = ROLE_META[role];
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!meta) return <Navigate to="/" replace />;
  if (user) return <Navigate to={`/${user.role}`} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) return setError('Please enter your email and password.');
    setBusy(true);
    try {
      const u = await login(email.trim(), password, role);
      const from = location.state?.from;
      navigate(from && from.startsWith(`/${u.role}`) ? from : `/${u.role}`, { replace: true });
    } catch (err) {
      setError(err.userMessage || 'Could not sign in');
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className={`vignette relative hidden overflow-hidden bg-gradient-to-br ${meta.gradient} lg:flex lg:flex-col lg:justify-between lg:p-14`}>
        <div className="pointer-events-none absolute -left-20 top-1/3 h-96 w-96 rounded-full blur-[120px]" style={{ background: meta.glow }} />
        <Link to="/" className="relative z-10 w-fit"><img src="/logo-wordmark.png" alt="MayKraft Studios" className="h-12 w-auto" /></Link>
        <div className="relative z-10 animate-fade-up">
          <div className="font-display text-2xl italic text-cream/50">{meta.numeral}</div>
          <h1 className="mt-4 font-display text-7xl text-cream xl:text-8xl">{meta.title}</h1>
          <p className="mt-6 max-w-md font-display text-2xl italic leading-snug text-cream-soft/75">“{meta.quote}”</p>
        </div>
        <div className="relative z-10 text-[10px] uppercase tracking-[0.4em] text-cream/50">Purpose · Virality · Quality</div>
      </section>

      <section className="relative flex flex-col justify-center px-5 py-10 sm:px-12 lg:px-16">
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b ${meta.gradient} opacity-60 lg:hidden`} />
        <div className="relative mx-auto w-full max-w-sm animate-fade-up">
          <Link to="/" className="mb-10 inline-flex items-center gap-2 text-xs text-muted transition hover:text-cream">← All workspaces</Link>
          <img src="/logo-wordmark.png" alt="" className="mb-8 h-9 w-auto lg:hidden" />
          <div className="eyebrow">{meta.kicker}</div>
          <h2 className="mt-2 text-5xl">{meta.title} sign in</h2>
          <p className="mt-3 text-sm text-muted">{meta.blurb}</p>

          <form onSubmit={submit} className="mt-10 space-y-5" noValidate>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <p className="rounded-xl border border-bad/30 bg-bad/[0.06] px-4 py-3 text-sm text-bad" role="alert">{error}</p>}
            <button className="btn-primary w-full py-3" disabled={busy}>
              {busy ? <Spinner /> : null} {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {SHOW_DEMO && (
            <button
              type="button"
              onClick={() => { setEmail(meta.demo.email); setPassword(meta.demo.password); }}
              className="mt-6 w-full rounded-xl border border-dashed border-white/10 px-4 py-3 text-left text-xs text-muted transition hover:border-cream/30 hover:text-cream-soft"
            >
              <span className="eyebrow text-[10px]">Demo account — click to fill</span>
              <span className="mt-1 block break-all font-mono text-[11px]">{meta.demo.email} · {meta.demo.password}</span>
            </button>
          )}

          <p className="mt-10 text-xs text-muted">
            {role === 'manager' ? 'Manager accounts are created by the studio.' : 'Accounts are created by your MayKraft producer. Need access? Contact the studio.'}
          </p>
        </div>
      </section>
    </div>
  );
}
