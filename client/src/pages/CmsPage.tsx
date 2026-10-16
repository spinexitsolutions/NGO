import { lazy, Suspense, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import type { PageDraft } from '@ngo/shared';
import { ApiError } from '@/lib/api';
import { usePublic } from '@/lib/queries';
import { ErrorState, Spinner } from '@/components/ui';
import { Seo } from '@/components/site/Seo';
import { SectionList } from '@/features/sections/SectionRenderer';

const NotFoundPage = lazy(() => import('./NotFoundPage'));

export type PublishedPage = PageDraft & { slug: string; updatedAt: string };

/** Fetches a published CMS page. Used by every page that has editable content. */
export function usePage(slug: string) {
  return usePublic<PublishedPage>(`/public/pages/${slug}`);
}

/**
 * Renders a CMS page. `children` (e.g. an interactive listing) is inserted right after the first
 * section (normally the hero), so listing pages keep an editable hero and editable sections below.
 */
export function CmsPage({ slug: slugProp, children, fallbackTitle }: { slug?: string; children?: ReactNode; fallbackTitle?: string }) {
  const params = useParams();
  const slug = slugProp ?? params.slug ?? 'home';
  const { data, isLoading, error, refetch } = usePage(slug);
  if (isLoading)
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <Spinner />
      </div>
    );
  if (error instanceof ApiError && error.status === 404) {
    if (children) {
      return (
        <>
          <Seo title={fallbackTitle} />
          <div className="container-x pb-6 pt-16"><h1 className="h-section">{fallbackTitle}</h1></div>
          {children}
        </>
      );
    }
    return <Suspense fallback={null}><NotFoundPage /></Suspense>;
  }
  if (error || !data) return <div className="container-x py-24"><ErrorState message="We couldn’t load this page." onRetry={() => refetch()} /></div>;
  const hero = data.sections.find((s) => s.type === 'hero');
  const heroImage = (hero?.props.images as string[] | undefined)?.[0];
  return (
    <>
      <Seo title={slug === 'home' ? undefined : data.seo.title || data.title} description={data.seo.description} image={data.seo.image || heroImage} noIndex={data.seo.noIndex} />
      <SectionList sections={data.sections} insertAfterFirst={children} />
    </>
  );
}
