import { useState } from 'react';
import { navigationSchema, type FieldDef, type Navigation } from '@ngo/shared';
import { Spinner, Tabs } from '@/components/ui';
import { AdminPage } from '../ui';
import { PreviewFrame, PublishBar, useConfigEditor, VersionHistory } from './configEditor';
import { FieldForm } from './FieldForm';

const link: FieldDef[] = [{ name: 'label', label: 'Label', type: 'text', required: true, max: 40 }, { name: 'href', label: 'Link', type: 'link', required: true }];
const FIELDS: Record<'header' | 'footer' | 'legal', FieldDef[]> = {
  header: [{ name: 'header', label: 'Menu items', type: 'repeater', maxItems: 10, fields: [...link, { name: 'children', label: 'Dropdown links', type: 'repeater', maxItems: 12, fields: [...link, { name: 'description', label: 'Description', type: 'text', max: 100 }] }] }],
  footer: [{ name: 'footer', label: 'Footer columns', type: 'repeater', maxItems: 5, fields: [{ name: 'title', label: 'Column title', type: 'text', required: true, max: 40 }, { name: 'links', label: 'Links', type: 'repeater', maxItems: 12, fields: link }] }],
  legal: [{ name: 'legal', label: 'Legal links (bottom bar)', type: 'repeater', maxItems: 10, fields: link }],
};

export default function NavigationPage() {
  const editor = useConfigEditor<Navigation>('navigation', navigationSchema);
  const [tab, setTab] = useState<'header' | 'footer' | 'legal'>('header');
  const [history, setHistory] = useState(false);
  const n = editor.value;
  if (!n) return <div className="grid min-h-[50vh] place-items-center"><Spinner /></div>;
  return (
    <AdminPage title="Navigation menus" description="Header menu (with dropdowns), footer columns and legal links. Use internal paths like /donate or full https:// links. Reorder with the arrows." actions={<PublishBar editor={editor as never} onHistory={() => setHistory(true)} />}>
      <div className="grid gap-6 xl:grid-cols-[480px_1fr]">
        <div className="admin-card min-w-0">
          <Tabs tabs={[{ value: 'header', label: 'Header menu' }, { value: 'footer', label: 'Footer columns' }, { value: 'legal', label: 'Legal links' }] as const} value={tab} onChange={setTab} className="mb-5" />
          <FieldForm fields={FIELDS[tab]} value={n as unknown as Record<string, unknown>} onChange={(v) => editor.setValue(v as unknown as Navigation)} errors={editor.errors} groups={false} />
        </div>
        <div className="h-[75vh] min-h-[600px] xl:sticky xl:top-20">
          <PreviewFrame payload={{ navigation: n }} />
        </div>
      </div>
      <VersionHistory configKey="navigation" open={history} onClose={() => setHistory(false)} onRestored={(s) => editor.replaceFromServer(s as never)} />
    </AdminPage>
  );
}
