import { Helmet } from 'react-helmet-async';
import { useSite } from '@/app/SiteProvider';
import { Spinner } from '@/components/ui';
import { SectionList } from '@/features/sections/SectionRenderer';

/** Renders an unpublished page draft posted from the admin page builder (only inside its preview iframe). */
export default function PreviewPage() {
  const { previewPage } = useSite();
  return (
    <>
      <Helmet><meta name="robots" content="noindex" /><title>Preview</title></Helmet>
      {previewPage ? <SectionList sections={previewPage.sections} /> : <div className="grid min-h-[60vh] place-items-center text-ink-muted"><Spinner /> Waiting for preview…</div>}
    </>
  );
}
