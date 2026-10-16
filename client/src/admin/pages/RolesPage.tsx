import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lock, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { api, send } from '@/lib/api';
import { Badge, Button, EmptyState, Modal, useConfirm } from '@/components/ui';
import { AdminPage, QueryError } from '../ui';
import { AdminField, LoadingBlock, Section, useApiMutation } from './_common';

interface Role { id: string; key: string; name: string; description: string; isSystem: boolean; permissions: string[]; _count: { users: number } }
interface CatalogItem { key: string; group: string; label: string }

const SUPER = 'super_admin';

export default function RolesPage() {
  const key = ['admin', 'roles-full'];
  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => api<{ data: Role[]; meta: { catalog: CatalogItem[] } }>('/admin/roles') });
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => {
    if (data && (!selected || !data.data.some((r) => r.id === selected))) setSelected(data.data[0]?.id ?? null);
  }, [data, selected]);

  const groups = useMemo(() => {
    const m = new Map<string, CatalogItem[]>();
    (data?.meta.catalog ?? []).forEach((c) => m.set(c.group, [...(m.get(c.group) ?? []), c]));
    return [...m.entries()];
  }, [data]);

  const role = data?.data.find((r) => r.id === selected);
  return (
    <AdminPage title="Roles & permissions" description="Roles bundle permissions. Every staff user has exactly one role." actions={<Button size="sm" icon={Plus} onClick={() => setCreateOpen(true)}>New role</Button>}>
      {error ? (
        <QueryError error={error} retry={refetch} />
      ) : isLoading || !data ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <nav aria-label="Roles" className="admin-card h-fit p-2">
            <ul className="space-y-1">
              {data.data.map((r) => (
                <li key={r.id}>
                  <button onClick={() => setSelected(r.id)} aria-current={r.id === selected || undefined} className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${r.id === selected ? 'bg-primary/10 text-primary' : 'hover:bg-surface-alt'}`}>
                    <span>
                      <span className="block font-medium">{r.name}</span>
                      <span className="text-xs text-ink-muted">{r._count.users} user{r._count.users === 1 ? '' : 's'} · {r.key === SUPER ? 'all' : r.permissions.length} permissions</span>
                    </span>
                    {r.isSystem && <Lock className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-label="Built-in role" />}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          {role ? <RoleEditor key={role.id + role.permissions.join()} role={role} groups={groups} invalidate={key} /> : <EmptyState title="Select a role" />}
        </div>
      )}
      <CreateRoleModal open={createOpen} onClose={() => setCreateOpen(false)} groups={groups} invalidate={key} onCreated={(id) => setSelected(id)} />
    </AdminPage>
  );
}

function PermissionGrid({ groups, value, onChange, readOnly }: { groups: [string, CatalogItem[]][]; value: Set<string>; onChange: (v: Set<string>) => void; readOnly?: boolean }) {
  const toggle = (k: string, on: boolean) => {
    const next = new Set(value);
    if (on) next.add(k);
    else next.delete(k);
    onChange(next);
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map(([group, items]) => {
        const all = items.every((i) => value.has(i.key));
        return (
          <fieldset key={group} className="rounded-xl border border-line p-3" disabled={readOnly}>
            <legend className="flex w-full items-center justify-between gap-2 px-1 text-sm font-semibold">
              {group}
              {!readOnly && (
                <button type="button" className="text-xs font-normal text-primary hover:underline" onClick={() => { const next = new Set(value); items.forEach((i) => (all ? next.delete(i.key) : next.add(i.key))); onChange(next); }}>
                  {all ? 'Clear' : 'Select all'}
                </button>
              )}
            </legend>
            <div className="mt-1 space-y-2">
              {items.map((i) => (
                <label key={i.key} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--c-primary))]" checked={value.has(i.key)} onChange={(e) => toggle(i.key, e.target.checked)} />
                  <span>
                    {i.label}
                    <code className="block text-[11px] text-ink-muted">{i.key}</code>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function RoleEditor({ role, groups, invalidate }: { role: Role; groups: [string, CatalogItem[]][]; invalidate: unknown[] }) {
  const confirm = useConfirm();
  const isSuper = role.key === SUPER;
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [perms, setPerms] = useState(new Set(role.permissions));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = name !== role.name || description !== role.description || perms.size !== role.permissions.length || role.permissions.some((p) => !perms.has(p));
  const inv = [invalidate, ['admin', 'roles'], ['admin', 'me']];
  const save = useApiMutation(() => send(`/admin/roles/${role.id}`, { name, description, permissions: [...perms] }, 'PUT'), { success: 'Role saved', invalidate: inv, onFieldErrors: setErrors });
  const remove = useApiMutation(() => send(`/admin/roles/${role.id}`, { confirm: true }, 'DELETE'), { success: 'Role deleted', invalidate: inv });

  return (
    <Section
      title={<span className="flex flex-wrap items-center gap-2">{role.name} <code className="text-xs font-normal text-ink-muted">{role.key}</code>{role.isSystem && <Badge>Built-in</Badge>}</span>}
      actions={
        !isSuper && (
          <>
            {!role.isSystem && (
              <Button
                size="sm"
                variant="outline"
                icon={Trash2}
                className="text-red-700"
                loading={remove.isPending}
                disabled={role._count.users > 0}
                title={role._count.users > 0 ? 'Move users to another role first' : undefined}
                onClick={async () => {
                  if (await confirm({ title: `Delete role “${role.name}”?`, danger: true, confirmLabel: 'Delete role', message: 'This role will be permanently removed.' })) remove.mutate(undefined);
                }}
              >
                Delete
              </Button>
            )}
            <Button size="sm" icon={Save} loading={save.isPending} disabled={!dirty || !name.trim()} onClick={() => save.mutate(undefined)}>Save changes</Button>
          </>
        )
      }
    >
      {isSuper ? (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-primary/5 p-3 text-sm"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> The Super Admin role always has every permission and cannot be edited.</p>
      ) : (
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <AdminField label="Name" required error={errors.name}><input className="admin-input" minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></AdminField>
          <AdminField label="Description" error={errors.description}><input className="admin-input" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} /></AdminField>
        </div>
      )}
      {role._count.users > 0 && !isSuper && <p className="mb-4 text-xs text-ink-muted">Changes apply immediately to {role._count.users} user{role._count.users === 1 ? '' : 's'} with this role.</p>}
      {errors.permissions && <p className="mb-2 text-xs text-red-700">{errors.permissions}</p>}
      <PermissionGrid groups={groups} value={perms} onChange={setPerms} readOnly={isSuper} />
    </Section>
  );
}

function CreateRoleModal({ open, onClose, groups, invalidate, onCreated }: { open: boolean; onClose: () => void; groups: [string, CatalogItem[]][]; invalidate: unknown[]; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ key: '', name: '', description: '' });
  const [keyTouched, setKeyTouched] = useState(false);
  const [perms, setPerms] = useState<Set<string>>(new Set(['dashboard.view']));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^[^a-z]+/, '').replace(/_+$/, '').slice(0, 41);
  const validKey = /^[a-z][a-z0-9_]{2,40}$/.test(f.key);
  const create = useApiMutation(() => send<{ id: string }>('/admin/roles', { ...f, permissions: [...perms] }), {
    success: 'Role created',
    invalidate: [invalidate, ['admin', 'roles']],
    onFieldErrors: setErrors,
    onSuccess: (r) => {
      setF({ key: '', name: '', description: '' });
      setKeyTouched(false);
      setPerms(new Set(['dashboard.view']));
      onClose();
      onCreated(r.id);
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New role"
      size="xl"
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" form="role-form" loading={create.isPending} disabled={!validKey || f.name.trim().length < 2}>Create role</Button>
        </>
      }
    >
      <form id="role-form" onSubmit={(e) => { e.preventDefault(); create.mutate(undefined); }}>
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <AdminField label="Name" required error={errors.name}>
            <input className="admin-input" required minLength={2} maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, key: keyTouched ? f.key : slug(e.target.value) })} />
          </AdminField>
          <AdminField label="Key" required error={errors.key ?? (f.key && !validKey ? 'Lowercase letters, numbers and underscores; 3–41 characters, starting with a letter' : undefined)} help="Permanent identifier, e.g. field_officer">
            <input className="admin-input font-mono" required value={f.key} onChange={(e) => { setKeyTouched(true); setF({ ...f, key: e.target.value.toLowerCase() }); }} />
          </AdminField>
          <AdminField label="Description" error={errors.description}><input className="admin-input" maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></AdminField>
        </div>
        <PermissionGrid groups={groups} value={perms} onChange={setPerms} />
      </form>
    </Modal>
  );
}
