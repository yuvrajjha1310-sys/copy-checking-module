import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const shakeTimeout = useRef(null);

  useEffect(() => () => clearTimeout(shakeTimeout.current), []);

  function triggerShake() {
    setShake(false);
    // force a reflow so re-adding the class restarts the animation
    requestAnimationFrame(() => setShake(true));
    clearTimeout(shakeTimeout.current);
    shakeTimeout.current = setTimeout(() => setShake(false), 450);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
    } catch (err) {
      setError(err.message);
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode() {
    setError('');
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div
        className={`w-full max-w-sm card-surface rounded-2xl p-6 animate-card-in ${shake ? 'animate-shake' : ''}`}
      >
        <p className="text-xs tracking-widest uppercase text-[var(--accent)]/70 font-semibold mb-1">
          Copy &amp; Assignment Checking
        </p>
        <h1 key={mode} className="font-display text-2xl text-[var(--ink)] mb-6 animate-form-swap">
          {mode === 'login' ? 'Sign in' : 'Create an account'}
        </h1>

        <form key={mode} onSubmit={handleSubmit} className="space-y-3 animate-form-swap">
          {mode === 'signup' && (
            <div className="animate-field-in">
              <label className="block text-xs font-medium text-[var(--muted)] mb-1">Name</label>
              <input
                type="text"
                value={name}
                required
                onChange={(e) => setName(e.target.value)}
                className="input-field focus-ring w-full rounded-md border border-[var(--border)] bg-transparent text-[var(--ink)] px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">Email</label>
            <input
              type="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              className="input-field focus-ring w-full rounded-md border border-[var(--border)] bg-transparent text-[var(--ink)] px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">Password</label>
            <input
              type="password"
              value={password}
              required
              minLength={mode === 'signup' ? 8 : undefined}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field focus-ring w-full rounded-md border border-[var(--border)] bg-transparent text-[var(--ink)] px-3 py-2 text-sm focus:outline-none"
            />
            {mode === 'signup' && (
              <p className="text-xs text-[var(--muted)] mt-1 animate-field-in">At least 8 characters.</p>
            )}
          </div>

          {error && (
            <p className="animate-toast-in text-sm text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary focus-ring w-full rounded-md bg-[var(--accent)] text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting && <span className="spinner" />}
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={switchMode}
          className="btn focus-ring mt-4 text-xs text-[var(--muted)] hover:text-[var(--ink)] w-full text-center rounded-md py-1"
        >
          {mode === 'login' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
