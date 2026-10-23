import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="font-display text-[120px] leading-none text-cream/20">404</div>
      <h1 className="mt-4 text-4xl">This scene was cut.</h1>
      <p className="mt-2 text-sm text-muted">The page you’re looking for doesn’t exist.</p>
      <Link to="/" className="btn-ghost mt-8">Back to the studio</Link>
    </div>
  );
}
