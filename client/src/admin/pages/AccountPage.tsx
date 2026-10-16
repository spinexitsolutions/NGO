import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { KeyRound, Laptop, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';
import { PERMISSIONS, isPermission } from '@ngo/shared';
import { get, send } from '@/lib/api';
import { dateTime, relative } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { Badge, Button, useConfirm } from '@/components/ui';
import { AdminPage, DetailList, QueryError } from '../ui';
import { AdminField, LoadingBlock, PASSWORD_HINT, Section, useApiMutation } from './_common';

interface SessionRow { id: string; ip: string; userAgent: string; createdAt: string; lastSeenAt: string; current: boolean }

export default function AccountPage() {
  const { user } = useAuth();
  if (!user) return <AdminPage title="My account"><LoadingBlock /></AdminPage>;
  const perms = user.role.key === 'super_admin' ? ['All permissions'] : user.permissions.filter(isPermission).map((p) => PERMISSIONS[p].label);
  return (
    <AdminPage title="My account" description="Your profile, password, two-factor authentication and signed-in devices.">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Section title="Profile">
            <DetailList
              items={[
                ['Name', user.name],
                ['Email', user.email],
                ['Role', <Badge key="r" tone="brand">{user.role.name}</Badge>],
                ['Last sign-in', dateTime(user.lastLoginAt)],
              ]}
            />
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-ink-muted hover:text-ink">What can I access? ({user.role.key === 'super_admin' ? 'everything' : `${perms.length} permissions`})</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">{perms.map((p) => <li key={p}>{p}</li>)}</ul>
            </details>
            <p className="mt-4 text-xs text-ink-muted">To change your name or email, ask an administrator.</p>
          </Section>
          <PasswordSection />
        </div>
        <div className="space-y-6">
          <MfaSection />
          <SessionsSection />
        </div>
      </div>
    </AdminPage>
  );
}

function PasswordSection() {
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const change = useApiMutation(() => send('/auth/change-password', { currentPassword: f.currentPassword, newPassword: f.newPassword }), {
    success: 'Password changed. Other devices have been signed out.',
    invalidate: [['admin', 'sessions']],
    onFieldErrors: setErrors,
    onSuccess: () => setF({ currentPassword: '', newPassword: '', confirm: '' }),
  });
  const mismatch = f.confirm.length > 0 && f.confirm !== f.newPassword;
  return (
    <Section title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" aria-hidden /> Change password</span>}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (mismatch) return setErrors({ confirm: 'Passwords do not match' });
          change.mutate(undefined);
        }}
      >
        <AdminField label="Current password" required error={errors.currentPassword}><input type="password" className="admin-input" autoComplete="current-password" required value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /></AdminField>
        <AdminField label="New password" required error={errors.newPassword} help={PASSWORD_HINT}><input type="password" className="admin-input" autoComplete="new-password" minLength={10} maxLength={128} required value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} /></AdminField>
        <AdminField label="Confirm new password" required error={errors.confirm ?? (mismatch ? 'Passwords do not match' : undefined)}><input type="password" className="admin-input" autoComplete="new-password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></AdminField>
        <Button size="sm" type="submit" loading={change.isPending} disabled={!f.currentPassword || f.newPassword.length < 10 || mismatch}>Change password</Button>
      </form>
    </Section>
  );
}

function MfaSection() {
  const { user, refresh } = useAuth();
  const confirm = useConfirm();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const start = useApiMutation(() => send<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup'), { onSuccess: (r) => setSetup(r) });
  const enable = useApiMutation(() => send('/auth/mfa/enable', { code: code.replace(/\s/g, '') }), {
    success: 'Two-factor authentication is on',
    onFieldErrors: setErrors,
    onSuccess: () => {
      setSetup(null);
      setCode('');
      void refresh();
    },
  });
  const disable = useApiMutation(() => send('/auth/mfa/disable', { password }), {
    success: 'Two-factor authentication turned off',
    onFieldErrors: setErrors,
    onSuccess: () => {
      setPassword('');
      void refresh();
    },
  });
  const enabled = Boolean(user?.mfaEnabled);

  return (
    <Section title={<span className="flex items-center gap-2"><Smartphone className="h-4 w-4" aria-hidden /> Two-factor authentication</span>} actions={enabled ? <Badge tone="green"><ShieldCheck className="h-3 w-3" aria-hidden /> On</Badge> : <Badge tone="amber">Off</Badge>}>
      {enabled ? (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await confirm({ title: 'Turn off two-factor authentication?', danger: true, confirmLabel: 'Turn off', message: 'Your account will be protected by your password only. We strongly recommend keeping 2FA on.' })) disable.mutate(undefined);
          }}
        >
          <p className="text-sm text-ink-muted">Sign-ins require a code from your authenticator app. To turn this off, confirm your password.</p>
          <AdminField label="Password" required error={errors.password}><input type="password" className="admin-input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></AdminField>
          <Button size="sm" variant="outline" icon={ShieldOff} className="text-red-700" type="submit" loading={disable.isPending} disabled={!password}>Turn off 2FA</Button>
        </form>
      ) : setup ? (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); enable.mutate(undefined); }}>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).</li>
            <li>Scan this QR code, or enter the secret key manually.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div className="rounded-xl border border-line bg-white p-3">
              <QRCodeSVG value={setup.otpauthUrl} size={168} aria-label="QR code for your authenticator app" />
            </div>
            <div className="min-w-0 text-sm">
              <p className="admin-label">Secret key</p>
              <code className="block select-all break-all rounded-lg bg-surface-alt p-2 font-mono text-xs tracking-wider">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
            </div>
          </div>
          <AdminField label="6-digit code" required error={errors.code}>
            <input className="admin-input w-40 font-mono tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required value={code} onChange={(e) => setCode(e.target.value)} />
          </AdminField>
          <div className="flex gap-2">
            <Button size="sm" type="submit" loading={enable.isPending} disabled={code.replace(/\s/g, '').length < 6}>Verify & turn on</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => { setSetup(null); setCode(''); }}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">Add a second step at sign-in using an authenticator app. Strongly recommended for anyone who can see donor or beneficiary data.</p>
          <Button size="sm" icon={ShieldCheck} loading={start.isPending} onClick={() => start.mutate(undefined)}>Set up two-factor authentication</Button>
        </div>
      )}
    </Section>
  );
}

function describeAgent(ua: string) {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

function SessionsSection() {
  const confirm = useConfirm();
  const key = ['admin', 'sessions'];
  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => get<SessionRow[]>('/auth/sessions') });
  const revoke = useApiMutation((id: string) => send(`/auth/sessions/${id}`, undefined, 'DELETE'), { success: 'Device signed out', invalidate: [key] });
  return (
    <Section title={<span className="flex items-center gap-2"><Laptop className="h-4 w-4" aria-hidden /> Signed-in devices</span>}>
      {error ? (
        <QueryError error={error} retry={refetch} />
      ) : isLoading || !data ? (
        <LoadingBlock />
      ) : data.length === 0 ? (
        <p className="text-sm text-ink-muted">No active sessions.</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{describeAgent(s.userAgent)} {s.current && <Badge tone="green">This device</Badge>}</p>
                <p className="text-xs text-ink-muted">{s.ip || 'Unknown IP'} · active {relative(s.lastSeenAt)} · signed in {dateTime(s.createdAt)}</p>
              </div>
              {!s.current && (
                <Button
                  size="sm"
                  variant="outline"
                  loading={revoke.isPending && revoke.variables === s.id}
                  onClick={async () => {
                    if (await confirm({ title: 'Sign out this device?', confirmLabel: 'Sign out', message: `${describeAgent(s.userAgent)} (${s.ip || 'unknown IP'}) will be signed out.` })) revoke.mutate(s.id);
                  }}
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
