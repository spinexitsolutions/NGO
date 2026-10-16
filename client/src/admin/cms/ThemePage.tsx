import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, RotateCcw } from 'lucide-react';
import { FONT_CHOICES, themeSchema, type Theme } from '@ngo/shared';
import { get } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Spinner, Tabs } from '@/components/ui';
import { AdminPage } from '../ui';
import { PreviewFrame, PublishBar, useConfigEditor, VersionHistory } from './configEditor';

const TABS = [
  { value: 'presets', label: 'Presets' },
  { value: 'colors', label: 'Colours' },
  { value: 'typography', label: 'Typography' },
  { value: 'shape', label: 'Buttons & cards' },
  { value: 'layout', label: 'Layout' },
  { value: 'motion', label: 'Motion & mode' },
] as const;
type Tab = (typeof TABS)[number]['value'];

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

function ColorInput({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label={`${label} colour picker`} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-ink-muted">{label}</span>
        <input className={cn('w-full bg-transparent font-mono text-sm uppercase outline-none', error && 'text-red-700')} value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} aria-label={`${label} hex value`} />
      </span>
    </label>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string; preview?: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="admin-label">{label}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value} className={cn('rounded-xl border p-3 text-left text-sm transition', value === o.value ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'border-line hover:border-ink/30')}>
            {o.preview}
            <span className="font-medium">{o.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function ThemePage() {
  const editor = useConfigEditor<Theme>('theme', themeSchema);
  const presets = useQuery({ queryKey: ['admin', 'theme-presets'], queryFn: () => get<{ key: string; name: string; description: string; theme: Theme }[]>('/admin/config/presets/themes') });
  const [tab, setTab] = useState<Tab>('presets');
  const [history, setHistory] = useState(false);
  const t = editor.value;
  if (!t) return <div className="grid min-h-[50vh] place-items-center"><Spinner /></div>;
  const set = <K extends keyof Theme>(k: K, v: Theme[K]) => editor.setValue({ ...t, [k]: v });
  const e = editor.errors;
  const resetBtn = (group: keyof Theme, label: string) => (
    <button type="button" onClick={() => editor.resetGroup(group, label)} className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink"><RotateCcw className="h-3 w-3" /> Reset {label}</button>
  );
  const checks = [
    { label: 'Body text on background', ratio: contrast(t.colors.text, t.colors.background), min: 4.5 },
    { label: 'Button text on primary', ratio: contrast(t.colors.primaryContrast, t.colors.primary), min: 4.5 },
    { label: 'Muted text on background', ratio: contrast(t.colors.muted, t.colors.background), min: 4.5 },
    { label: 'Text on dark mode background', ratio: contrast(t.dark.text, t.dark.background), min: 4.5 },
  ];

  return (
    <AdminPage title="Theme & branding" description="Change colours, fonts, buttons, cards, spacing and motion for the whole website. Changes save as a draft and appear in the preview; visitors see them only after you publish." actions={<PublishBar editor={editor as never} onHistory={() => setHistory(true)} />}>
      <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
        <div className="admin-card min-w-0">
          <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-5" />
          {tab === 'presets' && (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">Start from a designed preset, then fine-tune. Applying a preset replaces the current draft theme.</p>
              {presets.data?.map((p) => {
                const active = JSON.stringify(p.theme.colors) === JSON.stringify(t.colors) && p.theme.typography.headingFont === t.typography.headingFont;
                return (
                  <button key={p.key} type="button" onClick={() => editor.setValue(p.theme)} className={cn('flex w-full items-center gap-4 rounded-xl border p-3 text-left transition', active ? 'border-primary ring-2 ring-primary/25' : 'border-line hover:border-ink/30')}>
                    <span className="flex shrink-0 overflow-hidden rounded-lg">
                      {[p.theme.colors.primary, p.theme.colors.accent, p.theme.colors.background, p.theme.colors.text].map((c) => <span key={c} className="h-12 w-6" style={{ background: c }} />)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold" style={{ fontFamily: p.theme.typography.headingFont }}>{p.name}</span>
                      <span className="block text-xs text-ink-muted">{p.description}</span>
                    </span>
                    {active && <Check className="h-5 w-5 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
          {tab === 'colors' && (
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between"><p className="admin-label">Brand & light mode</p>{resetBtn('colors', 'colours')}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(t.colors) as (keyof Theme['colors'])[]).map((k) => (
                    <ColorInput key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())} value={t.colors[k]} error={e[`colors.${k}`]} onChange={(v) => set('colors', { ...t.colors, [k]: v })} />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between"><p className="admin-label">Dark mode surfaces</p>{resetBtn('dark', 'dark mode')}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(t.dark) as (keyof Theme['dark'])[]).map((k) => (
                    <ColorInput key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())} value={t.dark[k]} error={e[`dark.${k}`]} onChange={(v) => set('dark', { ...t.dark, [k]: v })} />
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-surface-alt p-4">
                <p className="admin-label">Accessibility (WCAG AA contrast)</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {checks.map((c) => (
                    <li key={c.label} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">{c.ratio >= c.min ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}{c.label}</span>
                      <span className={cn('font-mono text-xs', c.ratio < c.min && 'font-bold text-amber-700')}>{c.ratio.toFixed(2)}:1</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {tab === 'typography' && (
            <div className="space-y-5">
              <div className="flex justify-end">{resetBtn('typography', 'typography')}</div>
              {(['headingFont', 'bodyFont'] as const).map((k) => (
                <label key={k} className="block">
                  <span className="admin-label">{k === 'headingFont' ? 'Heading font' : 'Body font'}</span>
                  <select className="admin-input" value={t.typography[k]} onChange={(ev) => set('typography', { ...t.typography, [k]: ev.target.value as Theme['typography']['headingFont'] })}>
                    {FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
              ))}
              <label className="block">
                <span className="admin-label">Base text size: {t.typography.baseSize}px</span>
                <input type="range" min={14} max={20} value={t.typography.baseSize} onChange={(ev) => set('typography', { ...t.typography, baseSize: Number(ev.target.value) })} className="w-full accent-[rgb(var(--c-primary))]" />
              </label>
              <label className="block">
                <span className="admin-label">Heading scale: {t.typography.scale.toFixed(2)}</span>
                <input type="range" min={1.1} max={1.5} step={0.01} value={t.typography.scale} onChange={(ev) => set('typography', { ...t.typography, scale: Number(ev.target.value) })} className="w-full accent-[rgb(var(--c-primary))]" />
                <span className="field-help">Larger values make headings more dramatic.</span>
              </label>
              <Choice label="Heading weight" value={t.typography.headingWeight} onChange={(v) => set('typography', { ...t.typography, headingWeight: v })} options={[{ value: '400', label: 'Regular' }, { value: '500', label: 'Medium' }, { value: '600', label: 'Semibold' }, { value: '700', label: 'Bold' }]} />
              <Choice label="Heading letter spacing" value={t.typography.headingTracking} onChange={(v) => set('typography', { ...t.typography, headingTracking: v })} options={[{ value: 'tight', label: 'Tight' }, { value: 'normal', label: 'Normal' }]} />
            </div>
          )}
          {tab === 'shape' && (
            <div className="space-y-6">
              <div className="flex justify-end">{resetBtn('shape', 'buttons & cards')}</div>
              <label className="block">
                <span className="admin-label">Corner radius (cards & images): {t.shape.radius}px</span>
                <input type="range" min={0} max={32} value={t.shape.radius} onChange={(ev) => set('shape', { ...t.shape, radius: Number(ev.target.value) })} className="w-full accent-[rgb(var(--c-primary))]" />
              </label>
              <Choice label="Button shape" value={t.shape.buttonShape} onChange={(v) => set('shape', { ...t.shape, buttonShape: v })} options={(['pill', 'rounded', 'square'] as const).map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1), preview: <span className="mb-2 block h-6 w-16 bg-primary" style={{ borderRadius: v === 'pill' ? 999 : v === 'rounded' ? 8 : 2 }} /> }))} />
              <Choice label="Button style" value={t.shape.buttonStyle} onChange={(v) => set('shape', { ...t.shape, buttonStyle: v })} options={[{ value: 'solid', label: 'Solid' }, { value: 'outline', label: 'Outline' }, { value: 'soft', label: 'Soft tint' }]} />
              <Choice label="Card style" value={t.shape.cardStyle} onChange={(v) => set('shape', { ...t.shape, cardStyle: v })} options={[{ value: 'elevated', label: 'Elevated (shadow)' }, { value: 'bordered', label: 'Bordered' }, { value: 'flat', label: 'Flat tint' }]} />
            </div>
          )}
          {tab === 'layout' && (
            <div className="space-y-6">
              <div className="flex justify-end">{resetBtn('layout', 'layout')}</div>
              <Choice label="Section spacing" value={t.layout.sectionSpacing} onChange={(v) => set('layout', { ...t.layout, sectionSpacing: v })} options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }, { value: 'spacious', label: 'Spacious' }]} />
              <Choice label="Content width" value={t.layout.containerWidth} onChange={(v) => set('layout', { ...t.layout, containerWidth: v })} options={[{ value: 'narrow', label: 'Narrow' }, { value: 'standard', label: 'Standard' }, { value: 'wide', label: 'Wide' }]} />
              <Choice label="Header over hero images" value={t.layout.headerStyle} onChange={(v) => set('layout', { ...t.layout, headerStyle: v })} options={[{ value: 'transparent', label: 'Transparent' }, { value: 'solid', label: 'Solid' }]} />
              <Choice label="Footer" value={t.layout.footerStyle} onChange={(v) => set('layout', { ...t.layout, footerStyle: v })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
            </div>
          )}
          {tab === 'motion' && (
            <div className="space-y-6">
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[rgb(var(--c-primary))]" checked={t.motion.enabled} onChange={(ev) => set('motion', { ...t.motion, enabled: ev.target.checked })} />
                <span><span className="font-medium">Enable animations</span><span className="block text-xs text-ink-muted">Scroll reveals, counters, hero slideshow and parallax. Visitors who prefer reduced motion never see them.</span></span>
              </label>
              <Choice label="Animation intensity" value={t.motion.intensity} onChange={(v) => set('motion', { ...t.motion, intensity: v })} options={[{ value: 'subtle', label: 'Subtle' }, { value: 'standard', label: 'Standard' }]} />
              <Choice label="Colour mode" value={t.colorMode} onChange={(v) => set('colorMode', v)} options={[{ value: 'light', label: 'Always light' }, { value: 'dark', label: 'Always dark' }, { value: 'user', label: 'Visitor choice' }]} />
            </div>
          )}
        </div>
        <div className="h-[75vh] min-h-[600px] xl:sticky xl:top-20">
          <PreviewFrame payload={{ theme: t }} />
        </div>
      </div>
      <VersionHistory configKey="theme" open={history} onClose={() => setHistory(false)} onRestored={(s) => editor.replaceFromServer(s as never)} />
    </AdminPage>
  );
}
