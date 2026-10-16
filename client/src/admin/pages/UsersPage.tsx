import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, LogOut, Pencil, ShieldOff, UserCheck, UserPlus, UserX, Users } from 'lucide-react';
import { get, send } from '@/lib/api';
import { date, relative } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { Badge, Button, Checkbox, EmptyState, Modal, useConfirm } from '@/components/ui';
import { AdminPage, DataTable, QueryError, type Column } from '../ui';
import { AdminField, PASSWORD_HINT, useApiMutation } from './_common';

interface StaffRow {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  lockedUntil: string | null;
  role: { id: string; key: string; name: string };
}
interface RoleOption { id: string; key: string; name: string }

export default function UsersPage() {
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const key = ['admin', 'users'];
  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => get<StaffRow[]>('/admin/users') });
  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => get<RoleOption[]>('/admin/roles') });
  const [editing, setEditing] = useState<StaffRow | 'new' | null>(null);
  const [resetting, setResetting] = useState<StaffRow | null>(null);

  const revoke = useApiMutation((u: StaffRow) => send<{ revoked: number }>(`/admin/users/${u.id}/revoke-sessions`), { success: (r) => `${r.revoked} session${r.revoked === 1 ? '' : 's'} signed out`, invalidate: [key] });
  const disableMfa = useApiMutation((u: StaffRow) => send(`/admin/users/${u.id}/disable-mfa`), { success: 'Two-factor authentication disabled', invalidate: [key] });
  const toggleActive = useApiMutation((u: StaffRow) => send(`/admin/users/${u.id}`, { name: u.name, email: u.email, roleId: u.role.id, isActive: !u.isActive }, 'PUT'), {
    success: (_r, u) => (u.isActive ? `${u.name} deactivated and signed out` : `${u.name} reactivated`),
    invalidate: [key],
  });

  const columns: Column<StaffRow>[] = [
    { key: 'name', header: 'Name', render: (u) => <div><p className="font-medium">{u.name}{u.id === me?.id && <span className="ml-1 text-xs text-ink-muted">(you)</span>}</p><p className="text-xs text-ink-muted">{u.email}</p></div> },
    { key: 'role', header: 'Role', render: (u) => <Badge tone={u.role.key === 'super_admin' ? 'brand' : 'neutral'}>{u.role.name}</Badge> },
    { key: 'mfa', header: '2FA', render: (u) => (u.mfaEnabled ? <Badge tone="green">On</Badge> : <Badge tone="amber">Off</Badge>) },
    { key: 'login', header: 'Last sign-in', render: (u) => <span className="whitespace-nowrap text-sm">{u.lastLoginAt ? relative(u.lastLoginAt) : <span className="text-ink-muted">Never</span>}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <span className="flex flex-wrap gap-1">
          {u.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
          {u.lockedUntil && new Date(u.lockedUntil) > new Date() && <Badge tone="red">Locked</Badge>}
        </span>
      ),
    },
    { key: 'created', header: 'Added', render: (u) => <span className="whitespace-nowrap">{date(u.createdAt)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (u) => {
        const self = u.id === me?.id;
        return (
          <div className="flex justify-end gap-1">
            <IconAction icon={Pencil} label={`Edit ${u.name}`} onClick={() => setEditing(u)} />
            <IconAction icon={KeyRound} label={`Reset password for ${u.name}`} onClick={() => setResetting(u)} />
            <IconAction
              icon={LogOut}
              label={`Sign ${u.name} out everywhere`}
              onClick={async () => {
                if (await confirm({ title: 'Sign out everywhere?', confirmLabel: 'Revoke sessions', message: self ? 'This signs you out of every device, including this one.' : `${u.name} will be signed out of every device.` })) revoke.mutate(u);
              }}
            />
            {u.mfaEnabled && (
              <IconAction
                icon={ShieldOff}
                label={`Disable 2FA for ${u.name}`}
                onClick={async () => {
                  if (await confirm({ title: 'Disable two-factor authentication?', danger: true, confirmLabel: 'Disable 2FA', message: `Use this only if ${u.name} has lost their authenticator. They should set it up again immediately.` })) disableMfa.mutate(u);
                }}
              />
            )}
            {!self && (
              <IconAction
                icon={u.isActive ? UserX : UserCheck}
                danger={u.isActive}
                label={u.isActive ? `Deactivate ${u.name}` : `Reactivate ${u.name}`}
                onClick={async () => {
                  const ok = await confirm(
                    u.isActive
                      ? { title: `Deactivate ${u.name}?`, danger: true, confirmLabel: 'Deactivate', message: 'They will be signed out immediately and cannot sign in until reactivated. Their records and audit history are kept.' }
                      : { title: `Reactivate ${u.name}?`, confirmLabel: 'Reactivate', message: 'They will be able to sign in again with their existing password.' },
                  );
                  if (ok) toggleActive.mutate(u);
                }}
              />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <AdminPage title="Staff users" description="People who can sign in to this admin. Access is controlled by their role." actions={<Button size="sm" icon={UserPlus} onClick={() => setEditing('new')}>Add user</Button>}>
      {error ? <QueryError error={error} retry={refetch} /> : <DataTable rows={data} columns={columns} loading={isLoading} empty={<EmptyState icon={Users} title="No staff users" />} />}
      <UserModal value={editing} roles={roles.data ?? []} selfId={me?.id} onClose={() => setEditing(null)} invalidate={key} />
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} invalidate={key} />
    </AdminPage>
  );
}

function IconAction({ icon: Icon, label, onClick, danger }: { icon: typeof Users; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={`rounded-lg border border-line p-2 transition hover:bg-surface-alt ${danger ? 'text-red-700 hover:border-red-300' : 'hover:border-primary hover:text-primary'}`}>
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

function UserModal({ value, roles, selfId, onClose, invalidate }: { value: StaffRow | 'new' | null; roles: RoleOption[]; selfId?: string; onClose: () => void; invalidate: unknown[] }) {
  const isNew = value === 'new';
  const [f, setF] = useState({ name: '', email: '', roleId: '', password: '', isActive: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    setErrors({});
    if (value && value !== 'new') setF({ name: value.name, email: value.email, roleId: value.role.id, password: '', isActive: value.isActive });
    else setF({ name: '', email: '', roleId: roles.find((r) => r.key !== 'super_admin')?.id ?? '', password: '', isActive: true });
  }, [value, roles]);
  const self = value !== 'new' && value?.id === selfId;
  const save = useApiMutation(
    () => (isNew ? send('/admin/users', { name: f.name, email: f.email, roleId: f.roleId, password: f.password }) : send(`/admin/users/${(value as StaffRow).id}`, { name: f.name, email: f.email, roleId: f.roleId, isActive: f.isActive }, 'PUT')),
    { success: isNew ? 'User created — share the initial password securely' : 'User updated', invalidate: [invalidate], onFieldErrors: setErrors, onSuccess: onClose },
  );
  return (
    <Modal
      open={value !== null}
      onClose={onClose}
      title={isNew ? 'Add staff user' : 'Edit staff user'}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" form="user-form" loading={save.isPending}>{isNew ? 'Create user' : 'Save'}</Button>
        </>
      }
    >
      <form id="user-form" className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined); }}>
        <AdminField label="Full name" required error={errors.name}><input className="admin-input" required minLength={2} maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></AdminField>
        <AdminField label="Email" required error={errors.email}><input type="email" className="admin-input" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="off" /></AdminField>
        <AdminField label="Role" required error={errors.roleId} help={self ? 'You cannot change your own role.' : undefined}>
          <select className="admin-input" required disabled={self} value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value })}>
            <option value="" disabled>Select a role…</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </AdminField>
        {isNew ? (
          <AdminField label="Initial password" required error={errors.password} help={`${PASSWORD_HINT} Ask them to change it after first sign-in.`}>
            <input type="text" className="admin-input font-mono" required minLength={10} maxLength={128} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
          </AdminField>
        ) : (
          <Checkbox label={self ? 'Active (you cannot deactivate yourself)' : 'Active — can sign in'} disabled={self} checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />
        )}
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose, invalidate }: { user: StaffRow | null; onClose: () => void; invalidate: unknown[] }) {
  const confirm = useConfirm();
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reset = useApiMutation(() => send(`/admin/users/${user?.id}/reset-password`, { password }), {
    success: 'Password reset. The user has been signed out everywhere.',
    invalidate: [invalidate],
    onFieldErrors: setErrors,
    onSuccess: () => {
      setPassword('');
      onClose();
    },
  });
  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title={`Reset password for ${user?.name ?? ''}`}
      size="sm"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="danger" type="submit" form="reset-form" loading={reset.isPending} disabled={password.length < 10}>Reset password</Button>
        </>
      }
    >
      <form
        id="reset-form"
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await confirm({ title: 'Reset password?', danger: true, confirmLabel: 'Reset', message: `${user?.name} will be signed out of all devices and must use the new password.` })) reset.mutate(undefined);
        }}
      >
        <AdminField label="New password" required error={errors.password} help={PASSWORD_HINT}>
          <input type="text" className="admin-input font-mono" minLength={10} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </AdminField>
        <p className="text-xs text-ink-muted">Share the new password through a secure channel, never by plain email.</p>
      </form>
    </Modal>
  );
}
