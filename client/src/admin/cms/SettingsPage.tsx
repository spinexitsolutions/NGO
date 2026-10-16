import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { SOCIAL_NETWORKS, settingsSchema, type FieldDef, type SiteSettings } from '@ngo/shared';
import { cn } from '@/lib/cn';
import { money } from '@/lib/format';
import { Spinner } from '@/components/ui';
import { AdminPage } from '../ui';
import { PreviewFrame, PublishBar, useConfigEditor, VersionHistory } from './configEditor';
import { FieldForm } from './FieldForm';

type Group = keyof SiteSettings;
const t = (name: string, label: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, label, type: 'text', ...extra });
const b = (name: string, label: string, help?: string): FieldDef => ({ name, label, type: 'boolean', help });

const GROUPS: { key: Group; label: string; description: string; fields: FieldDef[] }[] = [
  {
    key: 'organization', label: 'Organisation', description: 'Name, logo and favicon used across the site, emails and receipts.',
    fields: [t('name', 'Organisation name', { required: true, max: 120 }), t('shortName', 'Short name (header)', { max: 40 }), t('tagline', 'Tagline', { max: 160 }), { name: 'description', label: 'Short description', type: 'textarea', max: 600 }, { name: 'logo', label: 'Logo (for light backgrounds)', type: 'image' }, { name: 'logoLight', label: 'Logo for dark backgrounds (optional)', type: 'image' }, { name: 'favicon', label: 'Favicon (square, 512×512 PNG recommended)', type: 'image' }, { name: 'foundedYear', label: 'Founded year', type: 'number', min: 1800, max: 2100 }],
  },
  {
    key: 'contact', label: 'Contact', description: 'Shown in the footer, contact page and WhatsApp button.',
    fields: [t('email', 'Email', { type: 'email' }), t('phone', 'Phone', { max: 40 }), t('whatsapp', 'WhatsApp number (digits with country code, e.g. 919800000000)', { max: 20 }), { name: 'address', label: 'Address', type: 'textarea', max: 400 }, t('hours', 'Office hours', { max: 120 }), t('mapEmbedUrl', 'Map embed URL (Google Maps “Embed a map” src or OpenStreetMap embed)', { max: 1000 })],
  },
  {
    key: 'registration', label: 'Registration & tax', description: 'Legal details are shown publicly and on receipts ONLY when “verified” is ticked. Never enter credentials you have not verified.',
    fields: [b('verified', 'These registration details are verified and may be published'), t('legalName', 'Legal name', { max: 200 }), t('registrationType', 'Registration type (e.g. Registered Trust, Section 8 Company)', { max: 120 }), t('registrationNumber', 'Registration number', { max: 120 }), t('pan', 'PAN', { max: 20 }), b('taxExemptionEnabled', 'Show tax-benefit text on receipts and donate page', 'Only enable once your tax-exemption approval is verified and current.'), { name: 'taxExemptionText', label: 'Tax-benefit text', type: 'textarea', max: 400 }, { name: 'otherCredentials', label: 'Other credentials', type: 'repeater', maxItems: 10, fields: [t('label', 'Label', { required: true, max: 80 }), t('value', 'Value', { required: true, max: 160 })] }],
  },
  {
    key: 'social', label: 'Social links', description: 'Icons in the footer.',
    fields: [],
  },
  {
    key: 'announcement', label: 'Announcement bar', description: 'A slim message at the very top of every page.',
    fields: [b('enabled', 'Show announcement bar'), t('text', 'Message', { max: 200 }), t('linkLabel', 'Link label', { max: 40 }), { name: 'href', label: 'Link', type: 'link' }, { name: 'tone', label: 'Colour', type: 'select', options: [{ value: 'accent', label: 'Accent' }, { value: 'primary', label: 'Brand' }, { value: 'neutral', label: 'Dark' }] }],
  },
  { key: 'header', label: 'Header', description: 'Header button and search.', fields: [t('ctaLabel', 'Header button label (empty to hide)', { max: 30 }), { name: 'ctaHref', label: 'Header button link', type: 'link' }, b('showSearch', 'Show search icon')] },
  { key: 'footer', label: 'Footer', description: 'Footer text and newsletter block. Footer link columns are edited in Navigation.', fields: [{ name: 'about', label: 'About text', type: 'textarea', max: 400 }, b('showNewsletter', 'Show newsletter signup in footer'), t('newsletterHeading', 'Newsletter heading', { max: 120 }), { name: 'newsletterText', label: 'Newsletter text', type: 'textarea', max: 240 }, t('copyright', 'Copyright line ({year} is replaced automatically)', { max: 200 })] },
  {
    key: 'donation', label: 'Donations', description: 'Checkout amounts, monthly giving, thank-you message, bank/UPI details and receipts.',
    fields: [
      { name: 'currency', label: 'Currency', type: 'select', options: [{ value: 'INR', label: 'INR ₹' }, { value: 'USD', label: 'USD $' }, { value: 'EUR', label: 'EUR €' }, { value: 'GBP', label: 'GBP £' }] },
      { name: 'minAmount', label: 'Minimum amount', type: 'money', required: true },
      { name: 'maxAmount', label: 'Maximum amount', type: 'money', required: true },
      b('recurringEnabled', 'Offer monthly giving', 'Requires Razorpay Subscriptions to be enabled on your account.'),
      b('allowAnonymous', 'Allow anonymous donations (name hidden publicly; still required for receipts)'),
      b('collectPhone', 'Ask for phone number'),
      b('collectPan', 'Ask for PAN and address (needed for some tax receipts)'),
      t('thankYouHeading', 'Thank-you heading', { max: 120 }),
      { name: 'thankYouMessage', label: 'Thank-you message', type: 'textarea', max: 1000 },
      { name: 'receiptFooter', label: 'Receipt footer text', type: 'textarea', max: 500 },
      t('signatoryName', 'Receipt signatory name', { max: 80 }),
      t('signatoryTitle', 'Receipt signatory title', { max: 80 }),
    ],
  },
  { key: 'seo', label: 'SEO', description: 'Defaults used when a page has no SEO fields.', fields: [t('titleTemplate', 'Title template (%s = page title, {site} = organisation)', { max: 80 }), { name: 'defaultDescription', label: 'Default description', type: 'textarea', max: 170 }, { name: 'ogImage', label: 'Default social sharing image (1200×630)', type: 'image' }] },
  { key: 'analytics', label: 'Analytics', description: 'Loaded only after visitors accept analytics cookies.', fields: [t('googleAnalyticsId', 'Google Analytics 4 ID (G-XXXXXXX)', { max: 30 }), t('plausibleDomain', 'Plausible domain (e.g. example.org)', { max: 100 })] },
  { key: 'cookieConsent', label: 'Cookie consent', description: 'Banner shown when analytics are configured.', fields: [b('enabled', 'Ask for consent before loading analytics'), { name: 'text', label: 'Banner text', type: 'textarea', max: 400 }, { name: 'policyHref', label: 'Policy link', type: 'link' }] },
  { key: 'features', label: 'Features', description: 'Turn site features on or off.', fields: [b('volunteers', 'Volunteer applications'), b('events', 'Events & registrations'), b('blog', 'Blog & news'), b('donorPortal', 'Donor portal (magic-link login)'), b('whatsappButton', 'Floating WhatsApp button'), b('languageSwitcher', 'Language switcher (multilingual-ready; content translation is managed per page)')] },
  { key: 'languages', label: 'Languages', description: 'Languages offered in the switcher.', fields: [] },
];

const SOCIAL_FIELDS: FieldDef[] = [{ name: 'items', label: 'Links', type: 'repeater', maxItems: 10, fields: [{ name: 'network', label: 'Network', type: 'select', options: SOCIAL_NETWORKS.map((n) => ({ value: n, label: n })) }, { name: 'url', label: 'URL', type: 'link', required: true }] }];
const LANG_FIELDS: FieldDef[] = [{ name: 'items', label: 'Languages', type: 'repeater', maxItems: 8, fields: [t('code', 'Code (e.g. en, hi)', { required: true, max: 5 }), t('label', 'Label', { required: true, max: 40 })] }];

export default function SettingsPage() {
  const editor = useConfigEditor<SiteSettings>('settings', settingsSchema);
  const [group, setGroup] = useState<Group>('organization');
  const [history, setHistory] = useState(false);
  const s = editor.value;
  if (!s) return <div className="grid min-h-[50vh] place-items-center"><Spinner /></div>;
  const g = GROUPS.find((x) => x.key === group)!;
  const errorsFor = (k: string) => Object.fromEntries(Object.entries(editor.errors).filter(([p]) => p === k || p.startsWith(`${k}.`)).map(([p, m]) => [p.slice(k.length + 1) || k, m]));
  const groupHasError = (k: string) => Object.keys(editor.errors).some((p) => p === k || p.startsWith(`${k}.`));

  return (
    <AdminPage title="Site settings" description="Organisation details, contact information, donations, SEO and features. Edits are saved as a draft; publish to make them live." actions={<PublishBar editor={editor as never} onHistory={() => setHistory(true)} />}>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">
          {GROUPS.map((x) => (
            <button key={x.key} onClick={() => setGroup(x.key)} aria-current={group === x.key} className={cn('flex items-center justify-between whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm', group === x.key ? 'bg-primary text-primary-contrast' : 'text-ink-muted hover:bg-ink/5 hover:text-ink')}>
              {x.label}
              {groupHasError(x.key) && <span className="ml-2 h-2 w-2 rounded-full bg-red-500" aria-label="has errors" />}
            </button>
          ))}
        </nav>
        <div className="admin-card min-w-0">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div><h2 className="font-heading text-2xl">{g.label}</h2><p className="mt-1 text-sm text-ink-muted">{g.description}</p></div>
            <button onClick={() => editor.resetGroup(g.key, g.label)} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink"><RotateCcw className="h-3 w-3" /> Reset</button>
          </div>
          {group === 'social' ? (
            <FieldForm fields={SOCIAL_FIELDS} value={{ items: s.social }} onChange={(v) => editor.setValue({ ...s, social: v.items as SiteSettings['social'] })} errors={Object.fromEntries(Object.entries(errorsFor('social')).map(([k, m]) => [`items.${k}`, m]))} />
          ) : group === 'languages' ? (
            <FieldForm fields={LANG_FIELDS} value={{ items: s.languages }} onChange={(v) => editor.setValue({ ...s, languages: v.items as SiteSettings['languages'] })} errors={Object.fromEntries(Object.entries(errorsFor('languages')).map(([k, m]) => [`items.${k}`, m]))} />
          ) : (
            <>
              <FieldForm fields={g.fields} value={s[group] as Record<string, unknown>} onChange={(v) => editor.setValue({ ...s, [group]: v })} errors={errorsFor(group)} groups={false} />
              {group === 'donation' && <PresetAmounts value={s.donation.presetAmounts} currency={s.donation.currency} onChange={(presetAmounts) => editor.setValue({ ...s, donation: { ...s.donation, presetAmounts } })} />}
              {group === 'donation' && (
                <div className="mt-6 space-y-6 border-t border-line pt-6">
                  <div>
                    <h3 className="font-semibold">Bank transfer details</h3>
                    <p className="mb-3 text-xs text-ink-muted">Shown on the donate page only when enabled. Double-check every digit.</p>
                    <FieldForm groups={false} fields={[b('enabled', 'Show bank transfer details'), t('accountName', 'Account name'), t('accountNumber', 'Account number'), t('ifsc', 'IFSC'), t('bankName', 'Bank'), t('branch', 'Branch'), { name: 'notes', label: 'Notes', type: 'textarea', max: 400 }]} value={s.donation.bankTransfer as unknown as Record<string, unknown>} onChange={(v) => editor.setValue({ ...s, donation: { ...s.donation, bankTransfer: v as SiteSettings['donation']['bankTransfer'] } })} />
                  </div>
                  <div>
                    <h3 className="font-semibold">UPI</h3>
                    <FieldForm groups={false} fields={[b('enabled', 'Show UPI ID and QR code'), t('vpa', 'UPI ID (VPA)'), t('payeeName', 'Payee name')]} value={s.donation.upi as unknown as Record<string, unknown>} onChange={(v) => editor.setValue({ ...s, donation: { ...s.donation, upi: v as SiteSettings['donation']['upi'] } })} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="hidden h-[75vh] xl:sticky xl:top-20 xl:block">
          <PreviewFrame payload={{ settings: s }} path={group === 'donation' ? '/donate' : group === 'contact' ? '/contact' : '/'} />
        </div>
      </div>
      <VersionHistory configKey="settings" open={history} onClose={() => setHistory(false)} onRestored={(st) => editor.replaceFromServer(st as never)} />
    </AdminPage>
  );
}

function PresetAmounts({ value, currency, onChange }: { value: number[]; currency: string; onChange: (v: number[]) => void }) {
  const [draft, setDraft] = useState('');
  return (
    <div className="mt-6">
      <p className="admin-label">Preset amounts (1–6)</p>
      <div className="flex flex-wrap gap-2">
        {value.map((a, i) => (
          <span key={`${a}-${i}`} className="chip text-sm">
            {money(a, currency)}
            <button type="button" aria-label={`Remove ${money(a, currency)}`} onClick={() => value.length > 1 && onChange(value.filter((_, n) => n !== i))} className="ml-1 text-ink-muted hover:text-red-700">×</button>
          </span>
        ))}
      </div>
      {value.length < 6 && (
        <div className="mt-2 flex gap-2">
          <input type="number" min={1} className="admin-input w-40" placeholder="e.g. 1500" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="New preset amount" />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { const n = Math.round(Number(draft) * 100); if (n > 0) onChange([...value, n].sort((x, y) => x - y)); setDraft(''); }}>Add</button>
        </div>
      )}
    </div>
  );
}
