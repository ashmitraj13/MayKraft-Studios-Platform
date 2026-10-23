import { Link, Navigate } from 'react-router-dom';
import { ROLE_META } from '../lib/roles';
import { useAuth } from '../context/AuthContext';

const ORDER = ['manager', 'client', 'editor'];

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to={`/${user.role}`} replace />;

  return (
    <div className="vignette relative flex min-h-screen flex-col overflow-hidden">
      {/* light leak */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-navy/60 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-[-10%] h-[400px] w-[500px] rounded-full bg-cream/[0.04] blur-[120px]" />

      <header className="relative z-10 flex items-center justify-between px-5 py-6 sm:px-10">
        <span className="eyebrow">Est. Studio · India</span>
        <span className="eyebrow hidden sm:inline">Video production house</span>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-5 pb-16 pt-4 text-center sm:px-8">
        <img
          src="/logo-wordmark.png"
          alt="MayKraft Studios"
          className="w-[min(560px,82vw)] animate-fade-up drop-shadow-[0_10px_40px_rgba(230,228,192,0.12)]"
        />
        <p className="mt-8 animate-fade-up text-[11px] uppercase tracking-[0.5em] text-cream/80 [animation-delay:120ms] sm:text-xs">
          Purpose <span className="mx-2 text-cream/40">·</span> Virality <span className="mx-2 text-cream/40">·</span> Quality
        </p>
        <p className="mx-auto mt-6 max-w-xl animate-fade-up font-display text-xl italic leading-relaxed text-cream-soft/80 [animation-delay:220ms] sm:text-2xl text-balance">
          We craft films that mean something, travel far and look the part — from the first frame of footage to the final delivery.
        </p>

        <div className="mt-14 grid w-full gap-4 sm:mt-16 sm:gap-5 md:grid-cols-3">
          {ORDER.map((role, i) => {
            const m = ROLE_META[role];
            return (
              <Link
                key={role}
                to={`/login/${role}`}
                style={{ animationDelay: `${320 + i * 110}ms` }}
                className={`group relative flex min-h-[220px] animate-fade-up flex-col justify-between overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br ${m.gradient} p-7 text-left shadow-glow transition duration-500 hover:-translate-y-1 hover:border-cream/25 sm:min-h-[300px] sm:p-8`}
              >
                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-0 blur-3xl transition duration-700 group-hover:opacity-100"
                  style={{ background: m.glow }}
                />
                <div className="flex items-start justify-between">
                  <span className="font-display text-lg italic text-cream/50">{m.numeral}</span>
                  <span className="eyebrow text-[10px] text-cream/60">{m.kicker}</span>
                </div>
                <div>
                  <h2 className="font-display text-5xl text-cream sm:text-6xl">{m.title}</h2>
                  <p className="mt-3 max-w-[26ch] text-sm leading-relaxed text-cream-soft/70">{m.blurb}</p>
                  <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-cream/80">
                    <span className="h-px w-8 bg-cream/40 transition-all duration-500 group-hover:w-14 group-hover:bg-cream" />
                    Enter
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      <footer className="relative z-10 px-5 pb-8 text-center text-[11px] text-muted/70 sm:px-10">
        © {new Date().getFullYear()} MayKraft Studios. All rights reserved.
      </footer>
    </div>
  );
}
