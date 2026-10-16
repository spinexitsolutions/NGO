import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Eye, Mail, Megaphone, RotateCcw, Save, Send } from 'lucide-react';
import { api, get, send } from '@/lib/api';
import { date, dateTime } from '@/lib/format';
import { useAuth } from '@/app/AuthProvider';
import { Badge, Button, EmptyState, Pagination, Spinner, StatusBadge, Tabs, useConfirm } from '@/components/ui';
import { AdminPage, DataTable, QueryError, type Column, type ListMeta } from '../ui';
import { AdminField, LoadingBlock, Section, useApiMutation, useOptions } from './_common';

interface Template { key: string; name: string; description: string; subject: string; body: string; variables: string[]; isMarketing?: boolean; isCustomised: boolean; updatedAt?: string }
interface LogRow { id: string; to: string; templateKey: string; subject: string; status: string; error: string; relatedType: string; createdAt: string }
interface CampaignUpdate { id: string; title: string; campaignId: string; publishedAt: string; status: string }

type Tab = 'templates' | 'log' | 'announce';

export default function EmailTemplatesPage() {
  const [tab, setTab] = useState<Tab>('templates');
  return (
    <AdminPage title="Email" description="Edit the emails the system sends, review delivery, and announce campaign updates to subscribers.">
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'templates', label: 'Templates' },
          { value: 'log', label: 'Delivery log' },
          { value: 'announce', label: 'Announce campaign update' },
        ]}
      />
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'log' && <LogTab />}
      {tab === 'announce' && <AnnounceTab />}
    </AdminPage>
  );
}

function TemplatesTab() {
  const key = ['admin', 'email-templates'];
  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => get<Template[]>('/admin/email/templates') });
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected && data?.length) setSelected(data[0].key);
  }, [data, selected]);
  if (error) return <QueryError error={error} retry={refetch} />;
  if (isLoading || !data) return <LoadingBlock />;
  const tpl = data.find((t) => t.key === selected);
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <nav aria-label="Templates" className="admin-card h-fit p-2">
        <ul className="space-y-1">
          {data.map((t) => (
            <li key={t.key}>
              <button onClick={() => setSelected(t.key)} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${t.key === selected ? 'bg-primary/10 text-primary' : 'hover:bg-surface-alt'}`} aria-current={t.key === selected || undefined}>
                <span className="block font-medium">{t.name}</span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {t.isCustomised ? <Badge tone="blue">Customised</Badge> : <Badge>Default</Badge>}
                  {t.isMarketing && <Badge tone="amber">Marketing</Badge>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {tpl ? <TemplateEditor key={`${tpl.key}-${tpl.updatedAt ?? ''}-${tpl.isCustomised}`} tpl={tpl} invalidate={key} /> : <EmptyState title="Select a template" />}
    </div>
  );
}

function TemplateEditor({ tpl, invalidate }: { tpl: Template; invalidate: unknown[] }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState<'subject' | 'body'>('body');
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const dirty = subject !== tpl.subject || body !== tpl.body;

  // Debounced live preview.
  const [debounced, setDebounced] = useState({ subject, body });
  useEffect(() => {
    const t = setTimeout(() => setDebounced({ subject, body }), 400);
    return () => clearTimeout(t);
  }, [subject, body]);
  const preview = useQuery({
    queryKey: ['admin', 'email-preview', tpl.key, debounced],
    queryFn: () => send<{ subject: string; html: string }>(`/admin/email/templates/${tpl.key}/preview`, debounced),
    placeholderData: keepPreviousData,
  });

  const save = useApiMutation(() => send(`/admin/email/templates/${tpl.key}`, { subject, body }, 'PUT'), { success: 'Template saved', invalidate: [invalidate], onFieldErrors: setErrors });
  const reset = useApiMutation(() => send(`/admin/email/templates/${tpl.key}/reset`), { success: 'Template reset to default', invalidate: [invalidate] });
  const test = useApiMutation(() => send<{ ok: boolean }>(`/admin/email/templates/${tpl.key}/test`), { success: (r) => (r.ok ? `Test email sent to ${user?.email ?? 'you'}` : 'Test email could not be sent — check the delivery log') });

  const insert = (v: string) => {
    const token = `{{${v}}}`;
    const el = focus === 'subject' ? subjectRef.current : bodyRef.current;
    const value = focus === 'subject' ? subject : body;
    const setter = focus === 'subject' ? setSubject : setBody;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setter(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const vars = Array.from(new Set([...tpl.variables, 'orgName']));

  return (
    <div className="space-y-6">
      <Section
        title={tpl.name}
        actions={
          <>
            {tpl.isCustomised && (
              <Button
                size="sm"
                variant="outline"
                icon={RotateCcw}
                loading={reset.isPending}
                onClick={async () => {
                  if (await confirm({ title: 'Reset to default?', danger: true, confirmLabel: 'Reset template', message: 'Your customised subject and body will be discarded and the built-in default restored.' })) reset.mutate(undefined);
                }}
              >
                Reset to default
              </Button>
            )}
            <Button size="sm" variant="outline" icon={Send} loading={test.isPending} disabled={dirty} title={dirty ? 'Save first — the test uses the saved version' : undefined} onClick={() => test.mutate(undefined)}>Send test to me</Button>
            <Button size="sm" icon={Save} loading={save.isPending} disabled={!dirty} onClick={() => save.mutate(undefined)}>Save</Button>
          </>
        }
      >
        <p className="-mt-2 mb-4 text-sm text-ink-muted">{tpl.description}</p>
        {tpl.isMarketing && <p className="mb-4 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Marketing email — keep the {'{{unsubscribeUrl}}'} link so recipients can opt out.</p>}
        <div className="space-y-4">
          <AdminField label="Subject" error={errors.subject}>
            <input ref={subjectRef} className="admin-input" maxLength={200} value={subject} onFocus={() => setFocus('subject')} onChange={(e) => setSubject(e.target.value)} />
          </AdminField>
          <div>
            <p className="admin-label">Insert variable <span className="normal-case tracking-normal">(into the {focus})</span></p>
            <div className="flex flex-wrap gap-1.5">
              {vars.map((v) => (
                <button key={v} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(v)} className="rounded-full border border-line bg-surface-alt px-2.5 py-1 font-mono text-xs hover:border-primary hover:text-primary">
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>
          <AdminField label="Body (Markdown)" error={errors.body} help="Supports **bold**, _italic_, lists, and [links](https://…).">
            <textarea ref={bodyRef} className="admin-input min-h-[320px] font-mono text-xs leading-relaxed" maxLength={10000} value={body} onFocus={() => setFocus('body')} onChange={(e) => setBody(e.target.value)} />
          </AdminField>
          {dirty && <p className="text-xs text-amber-700">Unsaved changes</p>}
        </div>
      </Section>

      <Section title={<span className="flex items-center gap-2"><Eye className="h-4 w-4" aria-hidden /> Preview {preview.isFetching && <Spinner className="h-4" label="Updating preview" />}</span>}>
        {preview.error ? (
          <QueryError error={preview.error} retry={preview.refetch} />
        ) : preview.data ? (
          <>
            <p className="mb-3 text-sm"><span className="admin-label inline">Subject:</span> {preview.data.subject}</p>
            <iframe title="Email preview" sandbox="" srcDoc={preview.data.html} className="h-[520px] w-full rounded-xl border border-line bg-white" />
            <p className="mt-2 text-xs text-ink-muted">Variables are shown with sample placeholders like [donorName].</p>
          </>
        ) : (
          <LoadingBlock />
        )}
      </Section>
    </div>
  );
}

function LogTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'email-log', page],
    queryFn: () => api<{ data: LogRow[]; meta: ListMeta }>(`/admin/email/log?page=${page}`),
    placeholderData: keepPreviousData,
  });
  const columns: Column<LogRow>[] = [
    { key: 'date', header: 'Sent', render: (r) => <span className="whitespace-nowrap text-xs">{dateTime(r.createdAt)}</span> },
    { key: 'to', header: 'To', render: (r) => <span className="break-all">{r.to}</span> },
    { key: 'subject', header: 'Subject', render: (r) => <div className="min-w-[14rem]"><p>{r.subject}</p><p className="font-mono text-[11px] text-ink-muted">{r.templateKey}</p></div> },
    { key: 'status', header: 'Status', render: (r) => <div><StatusBadge status={r.status === 'SENT' ? 'SUCCESS' : r.status === 'SKIPPED' ? 'PENDING' : r.status} />{r.status === 'SKIPPED' && <span className="ml-1 text-xs text-ink-muted">skipped</span>}{r.error && <p className="mt-0.5 max-w-xs text-xs text-red-700">{r.error}</p>}</div> },
  ];
  if (error) return <QueryError error={error} retry={refetch} />;
  return (
    <>
      <DataTable rows={data?.data} columns={columns} loading={isLoading} empty={<EmptyState icon={Mail} title="No emails sent yet" />} />
      {data?.meta && (
        <div className="mt-2 flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-xs text-ink-muted">{data.meta.total.toLocaleString('en-IN')} emails</p>
          <Pagination page={data.meta.page} pages={data.meta.pages} onChange={setPage} />
        </div>
      )}
    </>
  );
}

function AnnounceTab() {
  const confirm = useConfirm();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'campaign-updates-published'],
    queryFn: () => api<{ data: CampaignUpdate[] }>('/admin/collections/campaignUpdates?status=PUBLISHED&limit=50'),
  });
  const campaigns = useOptions('campaigns');
  const [updateId, setUpdateId] = useState('');
  const [result, setResult] = useState<{ recipients: number; sent: number } | null>(null);
  const announce = useApiMutation((id: string) => send<{ recipients: number; sent: number }>('/admin/email/announce-campaign-update', { updateId: id, confirm: true }), {
    success: (r) => `Announcement sent to ${r.sent} of ${r.recipients} subscribers`,
    invalidate: [['admin', 'email-log']],
    onSuccess: (r) => setResult(r),
  });
  if (error) return <QueryError error={error} retry={refetch} />;
  if (isLoading || !data) return <LoadingBlock />;
  const updates = data.data;
  const chosen = updates.find((u) => u.id === updateId);
  const campaignTitle = (cid: string) => campaigns.data?.find((c) => c.id === cid)?.label ?? 'Campaign';

  return (
    <Section title="Announce a campaign update">
      <p className="mb-4 text-sm text-ink-muted">
        Emails a published campaign update to <strong>every subscribed newsletter address</strong> (excluding donors marked “do not contact”). Each email includes an unsubscribe link. Use sparingly.
      </p>
      {updates.length === 0 ? (
        <EmptyState icon={Megaphone} title="No published campaign updates">Publish an update under Content → Campaign updates first.</EmptyState>
      ) : (
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="admin-label">Choose an update</legend>
            {updates.map((u) => (
              <label key={u.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${updateId === u.id ? 'border-primary bg-primary/5' : 'border-line hover:border-primary/50'}`}>
                <input type="radio" name="update" className="mt-1 accent-[rgb(var(--c-primary))]" checked={updateId === u.id} onChange={() => { setUpdateId(u.id); setResult(null); }} />
                <span>
                  <span className="block font-medium">{u.title}</span>
                  <span className="text-xs text-ink-muted">{campaignTitle(u.campaignId)} · published {date(u.publishedAt)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Button
            icon={Send}
            disabled={!chosen}
            loading={announce.isPending}
            onClick={async () => {
              if (!chosen) return;
              const ok = await confirm({
                title: 'Email all subscribers?',
                danger: true,
                confirmLabel: 'Send announcement',
                message: `“${chosen.title}” (${campaignTitle(chosen.campaignId)}) will be emailed to every subscribed newsletter address right now. This cannot be recalled.`,
              });
              if (ok) announce.mutate(chosen.id);
            }}
          >
            Send announcement
          </Button>
          {result && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Sent to {result.sent} of {result.recipients} subscribers. See the delivery log for details.</p>}
        </div>
      )}
    </Section>
  );
}
