import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { KeyRound, Lock } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { useSite } from '@/app/SiteProvider';
import { ApiError, send } from '@/lib/api';
import { Button, Field, Input } from '@/components/ui';

export default function LoginPage() {
  const { user, refresh, mfaPending } = useAuth();
  const { settings } = useSite();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<'password' | 'mfa' | 'forgot' | 'sent'>(mfaPending ? 'mfa' : 'password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = params.get('next')?.startsWith('/admin') ? params.get('next')! : '/admin';
  if (user) return <Navigate to={next} replace />;

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <Helmet><title>Staff sign in</title><meta name="robots" content="noindex" /></Helmet>
      <div className="relative hidden overflow-hidden bg-secondary lg:block">
        <div className="bg-grain absolute inset-0" />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <p className="eyebrow text-accent">Admin</p>
          <h1 className="mt-4 font-heading text-5xl leading-tight">{settings.organization.name}</h1>
          <p className="mt-4 max-w-md text-white/70">Manage your website, campaigns, donations, volunteers and programmes in one place.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-accent">{step === 'mfa' ? <KeyRound className="h-6 w-6" /> : <Lock className="h-6 w-6" />}</span>
          {step === 'password' && (
            <form className="mt-6 space-y-5" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await send<{ mfaRequired?: boolean }>('/auth/login', { email, password }); if (r.mfaRequired) setStep('mfa'); else { await refresh(); navigate(next, { replace: true }); } }); }}>
              <div><h2 className="font-heading text-3xl">Staff sign in</h2><p className="mt-1 text-sm text-ink-muted">Accounts are created by an administrator.</p></div>
              <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
              <Field label="Password">{(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
              {error && <p className="field-error" role="alert">{error}</p>}
              <Button type="submit" loading={busy} className="w-full">Sign in</Button>
              <button type="button" className="w-full text-center text-sm text-primary hover:underline" onClick={() => { setError(''); setStep('forgot'); }}>Forgot password?</button>
            </form>
          )}
          {step === 'mfa' && (
            <form className="mt-6 space-y-5" onSubmit={(e) => { e.preventDefault(); run(async () => { await send('/auth/mfa/verify', { code }); await refresh(); navigate(next, { replace: true }); }); }}>
              <div><h2 className="font-heading text-3xl">Two-step verification</h2><p className="mt-1 text-sm text-ink-muted">Enter the 6-digit code from your authenticator app.</p></div>
              <Field label="Code">{(id) => <Input id={id} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center text-2xl tracking-[0.5em]" />}</Field>
              {error && <p className="field-error" role="alert">{error}</p>}
              <Button type="submit" loading={busy} className="w-full">Verify</Button>
            </form>
          )}
          {step === 'forgot' && (
            <form className="mt-6 space-y-5" onSubmit={(e) => { e.preventDefault(); run(async () => { await send('/auth/forgot-password', { email }); setStep('sent'); }); }}>
              <div><h2 className="font-heading text-3xl">Reset password</h2><p className="mt-1 text-sm text-ink-muted">We’ll email you a reset link if the account exists.</p></div>
              <Field label="Email">{(id) => <Input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
              {error && <p className="field-error" role="alert">{error}</p>}
              <Button type="submit" loading={busy} className="w-full">Send reset link</Button>
              <button type="button" className="w-full text-center text-sm text-primary hover:underline" onClick={() => setStep('password')}>Back to sign in</button>
            </form>
          )}
          {step === 'sent' && (
            <div className="mt-6 space-y-4">
              <h2 className="font-heading text-3xl">Check your email</h2>
              <p className="text-sm text-ink-muted">If an account exists for {email}, a reset link is on its way. It expires in one hour.</p>
              <button className="text-sm font-semibold text-primary" onClick={() => setStep('password')}>Back to sign in</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
