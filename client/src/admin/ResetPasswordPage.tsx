import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ApiError, send } from '@/lib/api';
import { Button, Field, Input } from '@/components/ui';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const token = params.get('token') ?? '';
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <Helmet><title>Reset password</title><meta name="robots" content="noindex" /></Helmet>
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-3xl">Choose a new password</h1>
        {done ? (
          <p className="mt-4 text-ink-muted">Your password has been changed and other sessions were signed out. <Link to="/admin/login" className="font-semibold text-primary">Sign in</Link></p>
        ) : (
          <form
            className="mt-6 space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              if (password !== confirm) return setError('Passwords do not match');
              setBusy(true);
              try {
                await send('/auth/reset-password', { token, password });
                setDone(true);
              } catch (err) {
                setError(err instanceof ApiError ? Object.values(err.fieldErrors)[0] ?? err.message : 'Something went wrong');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="New password" help="At least 10 characters with letters and numbers.">{(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
            <Field label="Confirm password">{(id) => <Input id={id} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />}</Field>
            {error && <p className="field-error" role="alert">{error}</p>}
            <Button type="submit" loading={busy} className="w-full" disabled={!token}>Update password</Button>
          </form>
        )}
      </div>
    </div>
  );
}
